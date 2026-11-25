-- The work loop: approved plans, claims, checks, scope decisions and releases.
-- API rate limits and monthly API write counts.
-- The free plan becomes one project per workspace.
-- Additive. The old MintAI tables stay in place but nothing reads them any more.

-- ─── 1. Work items ─────────────────────────────────────────────────────────────

create table if not exists public.work_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  outcome text not null default '' check (char_length(outcome) <= 4000),
  plan text not null default '' check (char_length(plan) <= 20000),
  acceptance text not null default '' check (char_length(acceptance) <= 8000),
  base_version text not null default '' check (char_length(base_version) <= 100),
  plan_version integer not null default 1 check (plan_version >= 1),
  state text not null default 'idea'
    check (state in ('idea', 'approved', 'in_progress', 'check_failed', 'qa_passed', 'accepted', 'released', 'dropped')),
  next_action text not null default '' check (char_length(next_action) <= 500),
  claimed_by text check (claimed_by is null or char_length(claimed_by) between 1 and 80),
  claimed_at timestamptz,
  claim_until timestamptz,
  available_since timestamptz,
  follows_id uuid references public.work_items(id) on delete set null,
  approved_by text,
  approved_at timestamptz,
  qa_build text,
  qa_passed_at timestamptz,
  accepted_by text,
  accepted_at timestamptz,
  released_version text,
  released_at timestamptz,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_work_items_project_state
  on public.work_items (project_id, state, updated_at desc);
create index if not exists idx_work_items_follows on public.work_items (follows_id);

-- ─── 2. What happened to each work item ───────────────────────────────────────

create table if not exists public.work_events (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.work_items(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null check (kind in (
    'created', 'edited', 'approved', 'claimed', 'handed_off', 'note',
    'check_failed', 'check_passed', 'scope_proposed', 'scope_approved', 'scope_deferred',
    'scope_rejected', 'accepted', 'released', 'reopened', 'dropped'
  )),
  actor text not null default '',
  via text not null default 'app' check (via in ('app', 'api')),
  body text not null default '' check (char_length(body) <= 8000),
  build text not null default '' check (char_length(build) <= 200),
  plan_version integer,
  created_at timestamptz not null default now()
);

create index if not exists idx_work_events_work on public.work_events (work_id, created_at);
create index if not exists idx_work_events_project_kind
  on public.work_events (project_id, kind, created_at desc);

-- ─── 3. Scope changes waiting for a person ────────────────────────────────────

create table if not exists public.work_decisions (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references public.work_items(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  proposal text not null check (char_length(proposal) between 1 and 4000),
  reason text not null default '' check (char_length(reason) <= 4000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'deferred', 'rejected')),
  proposed_by text not null default '',
  decided_by text,
  decided_at timestamptz,
  note text not null default '' check (char_length(note) <= 2000),
  result_work_id uuid references public.work_items(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_work_decisions_project_status
  on public.work_decisions (project_id, status, created_at desc);
create index if not exists idx_work_decisions_work on public.work_decisions (work_id, created_at);

-- ─── 4. Access: everyone in the workspace reads, owners and developers write ──

alter table public.work_items enable row level security;
alter table public.work_events enable row level security;
alter table public.work_decisions enable row level security;

drop policy if exists "Org users can read work_items" on public.work_items;
create policy "Org users can read work_items"
  on public.work_items for select to authenticated
  using (project_id in (select p.id from public.projects p where p.organization_id = public.current_org_id()));

drop policy if exists "Staff can manage work_items" on public.work_items;
create policy "Staff can manage work_items"
  on public.work_items for all to authenticated
  using (
    public.is_org_staff()
    and project_id in (select p.id from public.projects p where p.organization_id = public.current_org_id())
  )
  with check (
    public.is_org_staff()
    and project_id in (select p.id from public.projects p where p.organization_id = public.current_org_id())
  );

drop policy if exists "Org users can read work_events" on public.work_events;
create policy "Org users can read work_events"
  on public.work_events for select to authenticated
  using (project_id in (select p.id from public.projects p where p.organization_id = public.current_org_id()));

drop policy if exists "Staff can add work_events" on public.work_events;
create policy "Staff can add work_events"
  on public.work_events for insert to authenticated
  with check (
    public.is_org_staff()
    and project_id in (select p.id from public.projects p where p.organization_id = public.current_org_id())
  );

drop policy if exists "Org users can read work_decisions" on public.work_decisions;
create policy "Org users can read work_decisions"
  on public.work_decisions for select to authenticated
  using (project_id in (select p.id from public.projects p where p.organization_id = public.current_org_id()));

drop policy if exists "Staff can manage work_decisions" on public.work_decisions;
create policy "Staff can manage work_decisions"
  on public.work_decisions for all to authenticated
  using (
    public.is_org_staff()
    and project_id in (select p.id from public.projects p where p.organization_id = public.current_org_id())
  )
  with check (
    public.is_org_staff()
    and project_id in (select p.id from public.projects p where p.organization_id = public.current_org_id())
  );

drop trigger if exists work_items_monthly_limit on public.work_items;
create trigger work_items_monthly_limit
  before insert on public.work_items
  for each row execute procedure public.enforce_monthly_limit('work items', '20', '0');

-- ─── 5. API rate limits ───────────────────────────────────────────────────────

create table if not exists public.api_rate_windows (
  key_id uuid not null references public.api_keys(id) on delete cascade,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key_id, window_start)
);

create table if not exists public.api_usage_monthly (
  project_id uuid not null references public.projects(id) on delete cascade,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  writes integer not null default 0,
  reads integer not null default 0,
  primary key (project_id, period)
);

alter table public.api_rate_windows enable row level security;
alter table public.api_usage_monthly enable row level security;

drop policy if exists "Org users can read api_usage_monthly" on public.api_usage_monthly;
create policy "Org users can read api_usage_monthly"
  on public.api_usage_monthly for select to authenticated
  using (project_id in (select p.id from public.projects p where p.organization_id = public.current_org_id()));

-- Counts one API request. Every request counts toward the per-minute limit of its key.
-- Writes also count toward the project's monthly limit. Reads are counted but never blocked by it.
create or replace function public.api_hit(
  p_key uuid,
  p_project uuid,
  p_write boolean,
  p_minute_limit integer,
  p_month_limit integer
)
returns table (allowed boolean, minute_hits integer, month_writes integer, reason text)
language plpgsql security definer set search_path = public
as $$
#variable_conflict use_column
declare
  v_window timestamptz := date_trunc('minute', now());
  v_period text := to_char(timezone('utc', now()), 'YYYY-MM');
  v_hits integer;
  v_writes integer;
begin
  insert into public.api_rate_windows as w (key_id, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key_id, window_start) do update set hits = w.hits + 1
  returning w.hits into v_hits;

  if random() < 0.02 then
    delete from public.api_rate_windows where window_start < now() - interval '1 hour';
  end if;

  if v_hits > p_minute_limit then
    select u.writes into v_writes from public.api_usage_monthly u
    where u.project_id = p_project and u.period = v_period;
    return query select false, v_hits, coalesce(v_writes, 0), 'minute'::text;
    return;
  end if;

  if p_write then
    insert into public.api_usage_monthly as u (project_id, period, writes, reads)
    values (p_project, v_period, 1, 0)
    on conflict (project_id, period) do update set writes = u.writes + 1
      where u.writes < p_month_limit
    returning u.writes into v_writes;

    if v_writes is null then
      select u.writes into v_writes from public.api_usage_monthly u
      where u.project_id = p_project and u.period = v_period;
      return query select false, v_hits, coalesce(v_writes, 0), 'month'::text;
      return;
    end if;
  else
    insert into public.api_usage_monthly as u (project_id, period, writes, reads)
    values (p_project, v_period, 0, 1)
    on conflict (project_id, period) do update set reads = u.reads + 1
    returning u.writes into v_writes;
  end if;

  return query select true, v_hits, coalesce(v_writes, 0), null::text;
end;
$$;

revoke all on function public.api_hit(uuid, uuid, boolean, integer, integer) from public, anon, authenticated;
grant execute on function public.api_hit(uuid, uuid, boolean, integer, integer) to service_role;

-- ─── 6. Free plan: one project per workspace ──────────────────────────────────

create or replace function public.enforce_project_limit()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  existing integer;
begin
  if uid is null or public.is_premium(uid) then
    return new;
  end if;

  select count(*) into existing
  from public.projects
  where organization_id = new.organization_id;

  if existing >= 1 then
    raise exception 'The free plan has one project. Mint ($5 a month) removes that limit.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

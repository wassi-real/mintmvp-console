-- Premium billing, MintAI chat history, and the monthly limits.
-- Additive only. Nothing is deleted or rewritten.
--
-- Free: 2 projects in a workspace, and each month per project 30 tasks, 3 milestones,
-- 5 reports, 3 specs and 5 incidents. MintAI is off.
-- Premium ($5/month): unlimited projects, tasks, milestones and incidents. Reports stay
-- capped at 40 a month per project and specs at 20. MintAI allows 100 requests a month.

-- ─── 1. Subscription state (written only by the Stripe webhook, via the service role) ──

create table if not exists public.billing_subscriptions (
  user_id uuid primary key references public.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text not null default 'inactive'
    check (status in ('inactive', 'incomplete', 'active', 'trialing', 'past_due', 'canceled', 'unpaid', 'paused')),
  current_period_end timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.billing_subscriptions enable row level security;

drop policy if exists "Users can read own subscription" on public.billing_subscriptions;
create policy "Users can read own subscription"
  on public.billing_subscriptions for select to authenticated
  using (user_id = auth.uid());

-- ─── 2. MintAI chats (one person, one project, many saved conversations) ──

create table if not exists public.ai_chats (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_chats_owner
  on public.ai_chats (project_id, user_id, updated_at desc);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.ai_chats(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 20000),
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_messages_chat
  on public.ai_messages (chat_id, created_at);

alter table public.ai_chats enable row level security;
alter table public.ai_messages enable row level security;

drop policy if exists "Users read own ai chats" on public.ai_chats;
create policy "Users read own ai chats"
  on public.ai_chats for select to authenticated
  using (
    user_id = auth.uid()
    and project_id in (
      select p.id from public.projects p where p.organization_id = public.current_org_id()
    )
  );

drop policy if exists "Users insert own ai chats" on public.ai_chats;
create policy "Users insert own ai chats"
  on public.ai_chats for insert to authenticated
  with check (
    user_id = auth.uid()
    and project_id in (
      select p.id from public.projects p where p.organization_id = public.current_org_id()
    )
  );

drop policy if exists "Users update own ai chats" on public.ai_chats;
create policy "Users update own ai chats"
  on public.ai_chats for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users delete own ai chats" on public.ai_chats;
create policy "Users delete own ai chats"
  on public.ai_chats for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users read own ai messages" on public.ai_messages;
create policy "Users read own ai messages"
  on public.ai_messages for select to authenticated
  using (chat_id in (select c.id from public.ai_chats c where c.user_id = auth.uid()));

drop policy if exists "Users insert own ai messages" on public.ai_messages;
create policy "Users insert own ai messages"
  on public.ai_messages for insert to authenticated
  with check (
    role in ('user', 'assistant')
    and chat_id in (select c.id from public.ai_chats c where c.user_id = auth.uid())
  );

-- ─── 3. Monthly MintAI allowance ──

create table if not exists public.ai_usage (
  user_id uuid not null references public.users(id) on delete cascade,
  period text not null check (period ~ '^\d{4}-\d{2}$'),
  requests integer not null default 0 check (requests >= 0 and requests <= 100),
  primary key (user_id, period)
);

alter table public.ai_usage enable row level security;

drop policy if exists "Users read own ai usage" on public.ai_usage;
create policy "Users read own ai usage"
  on public.ai_usage for select to authenticated
  using (user_id = auth.uid());

create or replace function public.is_premium(p_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.billing_subscriptions b
    where b.user_id = p_user_id
      and b.status in ('active', 'trialing')
      and (b.current_period_end is null or b.current_period_end > now())
  )
$$;

create or replace function public.ai_allowance()
returns table (premium boolean, used integer, remaining integer)
language plpgsql stable security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  usage_period text := to_char(now() at time zone 'utc', 'YYYY-MM');
  is_paid boolean;
  used_count integer := 0;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  is_paid := public.is_premium(uid);

  select u.requests into used_count
  from public.ai_usage u
  where u.user_id = uid and u.period = usage_period;

  used_count := coalesce(used_count, 0);

  return query select
    is_paid,
    used_count,
    case when is_paid then greatest(100 - used_count, 0) else 0 end;
end;
$$;

-- Counts one request. Returns how many remain. Refuses when the person is not Premium
-- or has already used 100 this month. The cap is checked inside the update, so two
-- requests at once cannot both sneak past it.
create or replace function public.consume_ai_request()
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  usage_period text := to_char(now() at time zone 'utc', 'YYYY-MM');
  used_count integer;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if not public.is_premium(uid) then
    raise exception 'MintAI needs a Premium subscription' using errcode = '42501';
  end if;

  insert into public.ai_usage (user_id, period, requests)
  values (uid, usage_period, 1)
  on conflict (user_id, period)
  do update set requests = public.ai_usage.requests + 1
  where public.ai_usage.requests < 100
  returning requests into used_count;

  if used_count is null then
    raise exception 'You have used all 100 MintAI requests for this month' using errcode = 'P0001';
  end if;

  return 100 - used_count;
end;
$$;

-- Only the server calls this, after a failed model request, so a failure does not use up a request.
create or replace function public.refund_ai_request(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  usage_period text := to_char(now() at time zone 'utc', 'YYYY-MM');
begin
  update public.ai_usage
  set requests = greatest(requests - 1, 0)
  where user_id = p_user_id and period = usage_period;
end;
$$;

revoke execute on function
  public.is_premium(uuid),
  public.ai_allowance(),
  public.consume_ai_request(),
  public.refund_ai_request(uuid)
from public, anon;

grant execute on function public.is_premium(uuid), public.ai_allowance(), public.consume_ai_request()
  to authenticated, service_role;

grant execute on function public.refund_ai_request(uuid) to service_role;

-- ─── 4. Create limits, enforced in the database so the API and MintAI both obey them ──

create or replace function public.enforce_monthly_limit()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  noun text := tg_argv[0];
  free_cap integer := tg_argv[1]::integer;
  premium_cap integer := tg_argv[2]::integer;
  cap integer;
  existing integer;
begin
  if uid is null then
    return new;
  end if;

  cap := case when public.is_premium(uid) then premium_cap else free_cap end;
  if cap = 0 then
    return new;
  end if;

  execute format(
    'select count(*) from public.%I where project_id = $1 and created_at >= date_trunc(''month'', timezone(''utc'', now()))',
    tg_table_name
  ) into existing using new.project_id;

  if existing >= cap then
    raise exception 'Monthly limit reached for %s (%s per project). Premium is $5 a month.', noun, cap
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

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

  if existing >= 2 then
    raise exception 'This workspace already has the free limit of 2 projects. Premium removes that limit.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists reports_monthly_limit on public.reports;
create trigger reports_monthly_limit
  before insert on public.reports
  for each row execute procedure public.enforce_monthly_limit('reports', '5', '40');

drop trigger if exists specs_monthly_limit on public.specs;
create trigger specs_monthly_limit
  before insert on public.specs
  for each row execute procedure public.enforce_monthly_limit('specs', '3', '20');

drop trigger if exists tasks_monthly_limit on public.tasks;
create trigger tasks_monthly_limit
  before insert on public.tasks
  for each row execute procedure public.enforce_monthly_limit('tasks', '30', '0');

drop trigger if exists milestones_monthly_limit on public.milestones;
create trigger milestones_monthly_limit
  before insert on public.milestones
  for each row execute procedure public.enforce_monthly_limit('milestones', '3', '0');

drop trigger if exists incidents_monthly_limit on public.incidents;
create trigger incidents_monthly_limit
  before insert on public.incidents
  for each row execute procedure public.enforce_monthly_limit('incidents', '5', '0');

drop trigger if exists projects_free_limit on public.projects;
create trigger projects_free_limit
  before insert on public.projects
  for each row execute procedure public.enforce_project_limit();

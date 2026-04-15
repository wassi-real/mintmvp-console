-- Per-target HTTP monitoring, deployment observation log, github_deployments.ref for branch-scoped pipeline

alter table public.github_deployments add column if not exists ref text;

-- ─── Monitoring targets (URLs to probe) ─────────────────
create table if not exists public.monitoring_targets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  url text not null,
  enabled boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_monitoring_targets_project on public.monitoring_targets(project_id);

-- ─── Monitoring check runs (one row per probe) ────────────
create table if not exists public.monitoring_check_runs (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.monitoring_targets(id) on delete cascade,
  checked_at timestamptz not null default now(),
  ok boolean not null default false,
  http_status int,
  duration_ms int not null default 0,
  error_message text
);

create index if not exists idx_monitoring_check_runs_target_time
  on public.monitoring_check_runs(target_id, checked_at desc);

-- ─── Deployment observations (append-only audit from GitHub) ─
create table if not exists public.deployment_observations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  gh_deploy_id bigint not null,
  environment text not null default '',
  commit_sha text not null default '',
  ref text,
  state text not null,
  description text,
  observed_at timestamptz not null default now(),
  source text not null default 'github_webhook'
);

create index if not exists idx_deployment_observations_project
  on public.deployment_observations(project_id, observed_at desc);

-- ─── RLS ─────────────────────────────────────────────────

alter table public.monitoring_targets enable row level security;
alter table public.monitoring_check_runs enable row level security;
alter table public.deployment_observations enable row level security;

-- monitoring_targets
create policy "Org users can read monitoring_targets"
  on public.monitoring_targets for select
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid()
  ));

create policy "Staff can manage monitoring_targets"
  on public.monitoring_targets for all
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid() and u.role in ('owner', 'developer')
  ));

-- monitoring_check_runs (join through target for project scope)
create policy "Org users can read monitoring_check_runs"
  on public.monitoring_check_runs for select
  using (target_id in (
    select mt.id from public.monitoring_targets mt
    join public.projects p on p.id = mt.project_id
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid()
  ));

create policy "Staff can insert monitoring_check_runs"
  on public.monitoring_check_runs for insert
  with check (target_id in (
    select mt.id from public.monitoring_targets mt
    join public.projects p on p.id = mt.project_id
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid() and u.role in ('owner', 'developer')
  ));

-- deployment_observations (read-only for org; inserts via service role in webhook)
create policy "Org users can read deployment_observations"
  on public.deployment_observations for select
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid()
  ));

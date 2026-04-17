-- Railway deploy/build log ingestion and parsed observability events

create table if not exists public.project_integrations_railway (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade unique,
  api_token text not null default '',
  railway_project_id text not null default '',
  railway_environment_id text not null default '',
  railway_service_id text not null default '',
  enabled boolean not null default true,
  last_poll_at timestamptz,
  last_poll_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pir_project on public.project_integrations_railway(project_id);

create table if not exists public.deploy_log_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  railway_deployment_id text not null,
  log_kind text not null default 'deploy' check (log_kind in ('deploy', 'build')),
  logged_at timestamptz not null,
  message text not null,
  severity text,
  attributes jsonb not null default '{}'::jsonb,
  dedupe_key text not null,
  created_at timestamptz not null default now(),
  unique (project_id, dedupe_key)
);

create index if not exists idx_deploy_log_entries_project_time
  on public.deploy_log_entries(project_id, logged_at desc);

create index if not exists idx_deploy_log_entries_deploy
  on public.deploy_log_entries(project_id, railway_deployment_id, logged_at desc);

create table if not exists public.deploy_log_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  railway_deployment_id text,
  kind text not null,
  severity text not null default 'info',
  title text not null,
  detail text,
  occurred_at timestamptz not null,
  source_entry_id uuid references public.deploy_log_entries(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_deploy_log_events_project_time
  on public.deploy_log_events(project_id, occurred_at desc);

alter table public.project_integrations_railway enable row level security;
alter table public.deploy_log_entries enable row level security;
alter table public.deploy_log_events enable row level security;

create policy "Org users can read project_integrations_railway"
  on public.project_integrations_railway for select
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid()
  ));

create policy "Staff can manage project_integrations_railway"
  on public.project_integrations_railway for all
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid() and u.role in ('owner', 'developer')
  ));

create policy "Org users can read deploy_log_entries"
  on public.deploy_log_entries for select
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid()
  ));

create policy "Org users can read deploy_log_events"
  on public.deploy_log_events for select
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid()
  ));

-- MintMVP Console Schema

-- Organizations
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- Users (app-level profile linked to auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'client' check (role in ('owner', 'developer', 'client')),
  organization_id uuid references public.organizations(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  repo_url text,
  staging_url text,
  production_url text,
  status text not null default 'active' check (status in ('active', 'maintenance', 'paused')),
  created_at timestamptz not null default now()
);

-- Specs
create table if not exists public.specs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  summary text,
  goal text,
  acceptance_criteria text,
  edge_cases text,
  regression_risks text,
  status text not null default 'draft' check (status in ('draft', 'approved', 'in_dev', 'completed')),
  created_at timestamptz not null default now()
);

-- Tasks
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  spec_id uuid references public.specs(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'backlog' check (status in ('backlog', 'in_progress', 'review', 'testing', 'deployed')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  assignee text,
  created_at timestamptz not null default now()
);

-- Tests
create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  type text not null default 'manual' check (type in ('unit', 'integration', 'smoke', 'manual')),
  status text not null default 'pending' check (status in ('pass', 'fail', 'pending')),
  last_run timestamptz,
  notes text
);

-- Deployments
create table if not exists public.deployments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  environment text not null default 'staging' check (environment in ('staging', 'production')),
  version text not null,
  status text not null default 'pending' check (status in ('success', 'failed', 'pending')),
  notes text,
  created_at timestamptz not null default now()
);

-- Incidents
create table if not exists public.incidents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  status text not null default 'open' check (status in ('open', 'investigating', 'resolved')),
  description text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- Activity Log
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  action text not null,
  actor text not null,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- Indexes for common queries
create index if not exists idx_projects_org on public.projects(organization_id);
create index if not exists idx_specs_project on public.specs(project_id);
create index if not exists idx_tasks_project on public.tasks(project_id);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tests_project on public.tests(project_id);
create index if not exists idx_deployments_project on public.deployments(project_id);
create index if not exists idx_incidents_project on public.incidents(project_id);
create index if not exists idx_activity_project on public.activity_log(project_id);
create index if not exists idx_activity_created on public.activity_log(created_at desc);

-- RLS Policies
alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.specs enable row level security;
alter table public.tasks enable row level security;
alter table public.tests enable row level security;
alter table public.deployments enable row level security;
alter table public.incidents enable row level security;
alter table public.activity_log enable row level security;

-- Users can read their own profile
create policy "Users can read own profile"
  on public.users for select
  using (id = auth.uid());

-- Users can read their organization
create policy "Users can read own org"
  on public.organizations for select
  using (id in (select organization_id from public.users where id = auth.uid()));

-- Users can read projects in their org
create policy "Users can read org projects"
  on public.projects for select
  using (organization_id in (select organization_id from public.users where id = auth.uid()));

-- Owner/developer can insert/update projects
create policy "Staff can manage projects"
  on public.projects for all
  using (organization_id in (
    select organization_id from public.users
    where id = auth.uid() and role in ('owner', 'developer')
  ));

-- Spec read: anyone in the org via project
create policy "Org users can read specs"
  on public.specs for select
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid()
  ));

-- Spec write: owner/developer
create policy "Staff can manage specs"
  on public.specs for all
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid() and u.role in ('owner', 'developer')
  ));

-- Tasks read
create policy "Org users can read tasks"
  on public.tasks for select
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid()
  ));

-- Tasks write
create policy "Staff can manage tasks"
  on public.tasks for all
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid() and u.role in ('owner', 'developer')
  ));

-- Tests read
create policy "Org users can read tests"
  on public.tests for select
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid()
  ));

-- Tests write
create policy "Staff can manage tests"
  on public.tests for all
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid() and u.role in ('owner', 'developer')
  ));

-- Deployments read
create policy "Org users can read deployments"
  on public.deployments for select
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid()
  ));

-- Deployments write
create policy "Staff can manage deployments"
  on public.deployments for all
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid() and u.role in ('owner', 'developer')
  ));

-- Incidents read
create policy "Org users can read incidents"
  on public.incidents for select
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid()
  ));

-- Incidents write
create policy "Staff can manage incidents"
  on public.incidents for all
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid() and u.role in ('owner', 'developer')
  ));

-- Activity log read
create policy "Org users can read activity"
  on public.activity_log for select
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid()
  ));

-- Activity log write
create policy "Staff can insert activity"
  on public.activity_log for insert
  with check (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid() and u.role in ('owner', 'developer')
  ));

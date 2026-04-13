-- Phase 1: Codebase, Pipeline (derived), Environments, Monitoring, Tests upgrade

-- ─── Code Commits (manual) ────────────────────────────────
create table if not exists public.code_commits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  branch_name text not null,
  commit_message text not null,
  developer_name text not null default '',
  status text not null default 'draft' check (status in ('draft', 'in_review', 'merged')),
  task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_code_commits_project on public.code_commits(project_id);

-- ─── Repo Branches ────────────────────────────────────────
create table if not exists public.repo_branches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  last_activity_at timestamptz not null default now(),
  status text not null default 'stable' check (status in ('stable', 'testing', 'broken')),
  unique (project_id, name)
);

create index if not exists idx_repo_branches_project on public.repo_branches(project_id);

-- ─── Project Environments ─────────────────────────────────
create table if not exists public.project_environments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  kind text not null check (kind in ('development', 'staging', 'production')),
  url text not null default '',
  current_version text not null default '',
  last_deploy_at timestamptz,
  status text not null default 'unknown' check (status in ('healthy', 'broken', 'unknown')),
  unique (project_id, kind)
);

create index if not exists idx_project_environments_project on public.project_environments(project_id);

-- ─── Project Health (one row per project) ─────────────────
create table if not exists public.project_health (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade unique,
  uptime_status text not null default 'unknown' check (uptime_status in ('up', 'down', 'degraded', 'unknown')),
  last_check_at timestamptz,
  error_count integer not null default 0,
  warning_count integer not null default 0
);

create index if not exists idx_project_health_project on public.project_health(project_id);

-- ─── Tests: add spec_id, task_id, extend type ─────────────
alter table public.tests add column if not exists spec_id uuid references public.specs(id) on delete set null;
alter table public.tests add column if not exists task_id uuid references public.tasks(id) on delete set null;

-- Replace type check constraint to include 'e2e'
alter table public.tests drop constraint if exists tests_type_check;
alter table public.tests add constraint tests_type_check check (type in ('unit', 'integration', 'e2e', 'smoke', 'manual'));

-- ─── RLS ──────────────────────────────────────────────────

alter table public.code_commits enable row level security;
alter table public.repo_branches enable row level security;
alter table public.project_environments enable row level security;
alter table public.project_health enable row level security;

-- code_commits
create policy "Org users can read code_commits"
  on public.code_commits for select
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid()
  ));

create policy "Staff can manage code_commits"
  on public.code_commits for all
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid() and u.role in ('owner', 'developer')
  ));

-- repo_branches
create policy "Org users can read repo_branches"
  on public.repo_branches for select
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid()
  ));

create policy "Staff can manage repo_branches"
  on public.repo_branches for all
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid() and u.role in ('owner', 'developer')
  ));

-- project_environments
create policy "Org users can read project_environments"
  on public.project_environments for select
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid()
  ));

create policy "Staff can manage project_environments"
  on public.project_environments for all
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid() and u.role in ('owner', 'developer')
  ));

-- project_health
create policy "Org users can read project_health"
  on public.project_health for select
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid()
  ));

create policy "Staff can manage project_health"
  on public.project_health for all
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid() and u.role in ('owner', 'developer')
  ));

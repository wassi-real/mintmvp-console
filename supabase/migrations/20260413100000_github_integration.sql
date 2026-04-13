-- GitHub App Integration: sync tables, linking fields, webhook audit

-- ─── Project GitHub Integration (one per project) ────────
create table if not exists public.project_integrations_github (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade unique,
  installation_id bigint not null,
  repo_owner text not null,
  repo_name text not null,
  access_token text not null default '',
  token_expires_at timestamptz,
  last_sync_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_pig_project on public.project_integrations_github(project_id);
create index if not exists idx_pig_installation on public.project_integrations_github(installation_id);

-- ─── GitHub Branches ─────────────────────────────────────
create table if not exists public.github_branches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  last_commit_sha text not null default '',
  last_commit_message text not null default '',
  updated_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'stale')),
  unique (project_id, name)
);

create index if not exists idx_github_branches_project on public.github_branches(project_id);

-- ─── GitHub Pull Requests ────────────────────────────────
create table if not exists public.github_pull_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  gh_number integer not null,
  title text not null,
  branch text not null default '',
  status text not null default 'open' check (status in ('open', 'merged', 'closed')),
  author text not null default '',
  created_at timestamptz not null default now(),
  merged_at timestamptz,
  unique (project_id, gh_number)
);

create index if not exists idx_github_prs_project on public.github_pull_requests(project_id);

-- ─── GitHub Commits ──────────────────────────────────────
create table if not exists public.github_commits (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  sha text not null,
  branch text not null default '',
  message text not null default '',
  author text not null default '',
  committed_at timestamptz not null default now(),
  unique (project_id, sha)
);

create index if not exists idx_github_commits_project on public.github_commits(project_id);

-- ─── GitHub CI Runs ──────────────────────────────────────
create table if not exists public.github_ci_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  gh_run_id bigint not null,
  workflow_name text not null default '',
  branch text not null default '',
  commit_sha text not null default '',
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'success', 'failure', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (project_id, gh_run_id)
);

create index if not exists idx_github_ci_runs_project on public.github_ci_runs(project_id);

-- ─── GitHub Deployments ──────────────────────────────────
create table if not exists public.github_deployments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  gh_deploy_id bigint not null,
  environment text not null default 'production',
  commit_sha text not null default '',
  status text not null default 'pending' check (status in ('pending', 'success', 'failure', 'inactive')),
  created_at timestamptz not null default now(),
  unique (project_id, gh_deploy_id)
);

create index if not exists idx_github_deployments_project on public.github_deployments(project_id);

-- ─── Webhook Events (idempotency + audit) ────────────────
create table if not exists public.github_webhook_events (
  id uuid primary key default gen_random_uuid(),
  delivery_id text not null unique,
  event_type text not null,
  payload jsonb not null default '{}',
  processed_at timestamptz not null default now()
);

-- ─── Extend existing tables for cross-linking ────────────

-- tasks.branch_name — link task to a git branch
alter table public.tasks add column if not exists branch_name text;

-- tests.source + linked_commit — mark whether test came from GitHub CI
alter table public.tests add column if not exists source text not null default 'manual' check (source in ('manual', 'github'));
alter table public.tests add column if not exists linked_commit text;

-- milestones.task_id — link finance milestone to a task
alter table public.milestones add column if not exists task_id uuid references public.tasks(id) on delete set null;

-- ─── RLS ──────────────────────────────────────────────────

alter table public.project_integrations_github enable row level security;
alter table public.github_branches enable row level security;
alter table public.github_pull_requests enable row level security;
alter table public.github_commits enable row level security;
alter table public.github_ci_runs enable row level security;
alter table public.github_deployments enable row level security;
alter table public.github_webhook_events enable row level security;

-- Helper macro for project-scoped RLS
-- project_integrations_github
create policy "Org users can read project_integrations_github"
  on public.project_integrations_github for select
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid()
  ));
create policy "Staff can manage project_integrations_github"
  on public.project_integrations_github for all
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid() and u.role in ('owner', 'developer')
  ));

-- github_branches
create policy "Org users can read github_branches"
  on public.github_branches for select
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid()
  ));
create policy "Staff can manage github_branches"
  on public.github_branches for all
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid() and u.role in ('owner', 'developer')
  ));

-- github_pull_requests
create policy "Org users can read github_pull_requests"
  on public.github_pull_requests for select
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid()
  ));
create policy "Staff can manage github_pull_requests"
  on public.github_pull_requests for all
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid() and u.role in ('owner', 'developer')
  ));

-- github_commits
create policy "Org users can read github_commits"
  on public.github_commits for select
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid()
  ));
create policy "Staff can manage github_commits"
  on public.github_commits for all
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid() and u.role in ('owner', 'developer')
  ));

-- github_ci_runs
create policy "Org users can read github_ci_runs"
  on public.github_ci_runs for select
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid()
  ));
create policy "Staff can manage github_ci_runs"
  on public.github_ci_runs for all
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid() and u.role in ('owner', 'developer')
  ));

-- github_deployments
create policy "Org users can read github_deployments"
  on public.github_deployments for select
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid()
  ));
create policy "Staff can manage github_deployments"
  on public.github_deployments for all
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid() and u.role in ('owner', 'developer')
  ));

-- webhook_events: service-role only (no user RLS read needed)
create policy "Service role manages webhook_events"
  on public.github_webhook_events for all
  using (true);

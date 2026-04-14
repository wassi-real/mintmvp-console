-- Public read-only monitoring status pages (token URL; server uses service role to load data)

create table if not exists public.project_monitoring_public (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade unique,
  token text not null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (token)
);

create index if not exists idx_project_monitoring_public_token on public.project_monitoring_public (token)
  where is_enabled = true;

alter table public.project_monitoring_public enable row level security;

create policy "Org users can read project_monitoring_public"
  on public.project_monitoring_public for select
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid()
  ));

create policy "Staff can manage project_monitoring_public"
  on public.project_monitoring_public for all
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid() and u.role in ('owner', 'developer')
  ));

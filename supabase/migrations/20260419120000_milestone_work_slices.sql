-- Extended milestones (work tracking, optional bill) + slices + multi-task links

alter table public.milestones
  add column if not exists priority text not null default 'p3_normal'
    check (priority in ('p1_critical', 'p2_high', 'p3_normal', 'p4_low')),
  add column if not exists estimate text not null default '',
  add column if not exists phase text not null default 'planned'
    check (phase in ('planned', 'scoping', 'in_progress', 'testing', 'review', 'complete', 'blocked')),
  add column if not exists spec_id uuid references public.specs(id) on delete set null,
  add column if not exists owner_user_id uuid references public.users(id) on delete set null,
  add column if not exists attach_bill boolean not null default false,
  add column if not exists bill_amount numeric(12,2),
  add column if not exists bill_status text
    check (bill_status is null or bill_status in ('draft', 'sent', 'paid', 'overdue'));

create index if not exists idx_milestones_spec on public.milestones(spec_id);
create index if not exists idx_milestones_owner on public.milestones(owner_user_id);

create table if not exists public.milestone_slices (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references public.milestones(id) on delete cascade,
  title text not null,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done', 'blocked')),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_milestone_slices_milestone on public.milestone_slices(milestone_id);

create table if not exists public.milestone_task_links (
  milestone_id uuid not null references public.milestones(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  primary key (milestone_id, task_id)
);

create index if not exists idx_milestone_task_links_task on public.milestone_task_links(task_id);

alter table public.milestone_slices enable row level security;
alter table public.milestone_task_links enable row level security;

create policy "Org users can read milestone_slices"
  on public.milestone_slices for select
  using (milestone_id in (
    select m.id from public.milestones m
    join public.projects p on p.id = m.project_id
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid()
  ));

create policy "Staff can manage milestone_slices"
  on public.milestone_slices for all
  using (milestone_id in (
    select m.id from public.milestones m
    join public.projects p on p.id = m.project_id
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid() and u.role in ('owner', 'developer')
  ));

create policy "Org users can read milestone_task_links"
  on public.milestone_task_links for select
  using (milestone_id in (
    select m.id from public.milestones m
    join public.projects p on p.id = m.project_id
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid()
  ));

create policy "Staff can manage milestone_task_links"
  on public.milestone_task_links for all
  using (milestone_id in (
    select m.id from public.milestones m
    join public.projects p on p.id = m.project_id
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid() and u.role in ('owner', 'developer')
  ));

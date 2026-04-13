-- Finance module: milestones, payments, expenses

-- ─── Milestones ───────────────────────────────────────────
create table if not exists public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text not null default '',
  amount numeric(12,2) not null default 0,
  status text not null default 'planned' check (status in ('planned', 'active', 'ready_for_payment', 'paid', 'overdue')),
  due_date date,
  paid_date date,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_milestones_project on public.milestones(project_id);

-- ─── Payments ─────────────────────────────────────────────
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  milestone_id uuid references public.milestones(id) on delete set null,
  amount numeric(12,2) not null default 0,
  payment_method text not null default '' check (payment_method in ('', 'wise', 'bank_transfer', 'paypal', 'stripe', 'cash', 'other')),
  paid_at date not null default current_date,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_payments_project on public.payments(project_id);
create index if not exists idx_payments_milestone on public.payments(milestone_id);

-- ─── Expenses (optional internal cost tracking) ──────────
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  amount numeric(12,2) not null default 0,
  category text not null default '' check (category in ('', 'developer', 'hosting', 'domain', 'api_credits', 'design', 'marketing', 'other')),
  spent_at date not null default current_date,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists idx_expenses_project on public.expenses(project_id);

-- ─── RLS ──────────────────────────────────────────────────

alter table public.milestones enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;

-- milestones
create policy "Org users can read milestones"
  on public.milestones for select
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid()
  ));

create policy "Staff can manage milestones"
  on public.milestones for all
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid() and u.role in ('owner', 'developer')
  ));

-- payments
create policy "Org users can read payments"
  on public.payments for select
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid()
  ));

create policy "Staff can manage payments"
  on public.payments for all
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid() and u.role in ('owner', 'developer')
  ));

-- expenses
create policy "Org users can read expenses"
  on public.expenses for select
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid()
  ));

create policy "Staff can manage expenses"
  on public.expenses for all
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid() and u.role in ('owner', 'developer')
  ));

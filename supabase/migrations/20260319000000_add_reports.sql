-- Reports / Milestone Docs
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  content text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reports_project_id_idx on public.reports(project_id);

alter table public.reports enable row level security;

create policy "Authenticated users can read reports"
  on public.reports for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert reports"
  on public.reports for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update reports"
  on public.reports for update
  using (auth.role() = 'authenticated');

create policy "Authenticated users can delete reports"
  on public.reports for delete
  using (auth.role() = 'authenticated');

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger reports_updated_at
  before update on public.reports
  for each row execute procedure public.set_updated_at();

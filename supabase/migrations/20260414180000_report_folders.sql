-- Folders for organizing reports within a project

create table if not exists public.report_folders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  icon text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists report_folders_project_id_idx on public.report_folders(project_id);

alter table public.report_folders enable row level security;

create policy "Authenticated users can read report_folders"
  on public.report_folders for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert report_folders"
  on public.report_folders for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update report_folders"
  on public.report_folders for update
  using (auth.role() = 'authenticated');

create policy "Authenticated users can delete report_folders"
  on public.report_folders for delete
  using (auth.role() = 'authenticated');

create trigger report_folders_updated_at
  before update on public.report_folders
  for each row execute procedure public.set_updated_at();

alter table public.reports
  add column if not exists folder_id uuid references public.report_folders(id) on delete cascade;

create index if not exists reports_folder_id_idx on public.reports(folder_id);

-- Broadcast row changes to connected clients (multi-tab / collaborators)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reports'
  ) then
    alter publication supabase_realtime add table public.reports;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'report_folders'
  ) then
    alter publication supabase_realtime add table public.report_folders;
  end if;
end $$;

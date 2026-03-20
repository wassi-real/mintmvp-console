-- API Keys for programmatic access
create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  key_hash text not null,
  key_prefix text not null,
  created_by text not null default '',
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists api_keys_key_hash_idx on public.api_keys(key_hash);
create index if not exists api_keys_project_id_idx on public.api_keys(project_id);

alter table public.api_keys enable row level security;

create policy "Authenticated users can read api_keys"
  on public.api_keys for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert api_keys"
  on public.api_keys for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can delete api_keys"
  on public.api_keys for delete
  using (auth.role() = 'authenticated');

create policy "Authenticated users can update api_keys"
  on public.api_keys for update
  using (auth.role() = 'authenticated');

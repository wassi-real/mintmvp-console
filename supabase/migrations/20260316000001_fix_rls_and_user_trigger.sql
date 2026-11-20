-- Fix 1: Auto-create public.users profile when a new auth user signs up.
-- This trigger fires on INSERT into auth.users so every signup automatically
-- gets a profile row, preventing the chicken-and-egg RLS problem.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, full_name, role, organization_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'owner',
    null
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- Fix 2: Replace overly-restrictive organization policies.
-- Any authenticated user can read all organizations (internal tool).
-- Any authenticated user can insert an organization (first-time setup).

drop policy if exists "Users can read own org" on public.organizations;

create policy "Authenticated users can read orgs"
  on public.organizations for select
  to authenticated
  using (true);

create policy "Authenticated users can insert orgs"
  on public.organizations for insert
  to authenticated
  with check (true);


-- Fix 3: Allow users to insert and update their own profile row.

drop policy if exists "Users can read own profile" on public.users;

create policy "Users can read own profile"
  on public.users for select
  using (id = auth.uid());

create policy "Users can insert own profile"
  on public.users for insert
  with check (id = auth.uid());

create policy "Users can update own profile"
  on public.users for update
  using (id = auth.uid());

-- MintMVP Console rebuild, part 1: accounts, onboarding, workspaces and access control.
--
-- Additive and backward compatible. No table, column or row is dropped, truncated or rewritten.
-- What changes for existing data:
--   * every existing user gets a row in organization_members copied from users.organization_id / users.role
--   * access-control policies that let ANY signed-in account read or change another workspace's
--     data are replaced with workspace-scoped ones (see section 6). This matters now that anyone
--     can sign up.
--
-- Model: users.organization_id / users.role stay the "active workspace" that all existing RLS
-- policies already key on. organization_members records every workspace a user belongs to, and
-- the functions below are the only way to change the active workspace or a role.

-- ─── 1. Helper functions ──────────────────────────────────────────────────────
-- SECURITY DEFINER so policies on public.users can call them without recursing into themselves.

create or replace function public.current_org_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select organization_id from public.users where id = auth.uid()
$$;

create or replace function public.current_org_role()
returns text
language sql stable security definer set search_path = public
as $$
  select role from public.users where id = auth.uid() and organization_id is not null
$$;

create or replace function public.is_org_staff()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(public.current_org_role() in ('owner', 'developer'), false)
$$;

-- ─── 2. Profile fields ────────────────────────────────────────────────────────

alter table public.users
  add column if not exists username text,
  add column if not exists avatar_url text,
  add column if not exists bio text not null default '',
  add column if not exists onboarded_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.users drop constraint if exists users_username_format;
alter table public.users add constraint users_username_format
  check (username is null or username ~ '^[a-z0-9_]{3,24}$');

alter table public.users drop constraint if exists users_bio_length;
alter table public.users add constraint users_bio_length check (char_length(bio) <= 500);

create unique index if not exists users_username_key
  on public.users (username) where username is not null;

drop trigger if exists users_updated_at on public.users;
create trigger users_updated_at
  before update on public.users
  for each row execute procedure public.set_updated_at();

-- Deleting a workspace used to delete the profile of everyone whose active workspace it was.
-- Clear the pointer instead.
do $$
declare
  fk text;
begin
  select conname into fk
  from pg_constraint
  where conrelid = 'public.users'::regclass
    and contype = 'f'
    and confrelid = 'public.organizations'::regclass;
  if fk is not null then
    execute format('alter table public.users drop constraint %I', fk);
  end if;
  alter table public.users
    add constraint users_organization_id_fkey
    foreign key (organization_id) references public.organizations(id) on delete set null;
end $$;

-- Private onboarding answers (only the user can read their own).
create table if not exists public.user_onboarding (
  user_id uuid primary key references public.users(id) on delete cascade,
  persona text not null,
  use_cases text[] not null default '{}',
  referral_source text not null,
  referral_detail text not null default '',
  completed_at timestamptz not null default now()
);

alter table public.user_onboarding enable row level security;

drop policy if exists "Users can read own onboarding" on public.user_onboarding;
create policy "Users can read own onboarding"
  on public.user_onboarding for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can insert own onboarding" on public.user_onboarding;
create policy "Users can insert own onboarding"
  on public.user_onboarding for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update own onboarding" on public.user_onboarding;
create policy "Users can update own onboarding"
  on public.user_onboarding for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.username_available(p_username text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select auth.uid() is not null
    and p_username ~ '^[a-z0-9_]{3,24}$'
    and not exists (
      select 1 from public.users where username = p_username and id <> auth.uid()
    )
$$;

-- ─── 3. Workspace membership ──────────────────────────────────────────────────

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'client' check (role in ('owner', 'developer', 'client')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index if not exists idx_organization_members_user on public.organization_members(user_id);

-- Carry over every existing membership.
insert into public.organization_members (organization_id, user_id, role)
select organization_id, id, role
from public.users
where organization_id is not null
on conflict (organization_id, user_id) do nothing;

alter table public.organization_members enable row level security;

-- Read only. All writes go through the functions in section 5.
drop policy if exists "Members can read memberships" on public.organization_members;
create policy "Members can read memberships"
  on public.organization_members for select to authenticated
  using (user_id = auth.uid() or organization_id = public.current_org_id());

-- Keep users.role / users.organization_id in step with the membership table.
create or replace function public.sync_active_membership()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  next_org uuid;
  next_role text;
begin
  if tg_op = 'UPDATE' then
    update public.users
    set role = new.role
    where id = new.user_id
      and organization_id = new.organization_id
      and role is distinct from new.role;
  elsif tg_op = 'DELETE' then
    select m.organization_id, m.role into next_org, next_role
    from public.organization_members m
    where m.user_id = old.user_id
    order by m.created_at
    limit 1;

    update public.users
    set organization_id = next_org,
        role = coalesce(next_role, 'owner')
    where id = old.user_id
      and organization_id = old.organization_id;
  end if;
  return null;
end;
$$;

drop trigger if exists organization_members_sync on public.organization_members;
create trigger organization_members_sync
  after update or delete on public.organization_members
  for each row execute procedure public.sync_active_membership();

-- ─── 4. Invitations ───────────────────────────────────────────────────────────

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null check (email = lower(email) and email like '%_@_%'),
  role text not null default 'developer' check (role in ('developer', 'client')),
  invited_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  accepted_at timestamptz,
  revoked_at timestamptz
);

create unique index if not exists workspace_invites_open_key
  on public.workspace_invites (organization_id, email)
  where accepted_at is null and revoked_at is null;

create index if not exists idx_workspace_invites_email on public.workspace_invites(email);

alter table public.workspace_invites enable row level security;

drop policy if exists "Owners can read invites" on public.workspace_invites;
create policy "Owners can read invites"
  on public.workspace_invites for select to authenticated
  using (organization_id = public.current_org_id() and public.current_org_role() = 'owner');

drop policy if exists "Owners can create invites" on public.workspace_invites;
create policy "Owners can create invites"
  on public.workspace_invites for insert to authenticated
  with check (
    organization_id = public.current_org_id()
    and public.current_org_role() = 'owner'
    and invited_by = auth.uid()
    and accepted_at is null
  );

drop policy if exists "Owners can revoke invites" on public.workspace_invites;
create policy "Owners can revoke invites"
  on public.workspace_invites for update to authenticated
  using (organization_id = public.current_org_id() and public.current_org_role() = 'owner')
  with check (organization_id = public.current_org_id() and accepted_at is null);

-- ─── 5. Workspace functions ───────────────────────────────────────────────────

create or replace function public.create_workspace(p_name text)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  clean_name text := btrim(coalesce(p_name, ''));
  new_org uuid;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if char_length(clean_name) < 2 or char_length(clean_name) > 80 then
    raise exception 'Workspace name must be 2 to 80 characters' using errcode = '22023';
  end if;

  insert into public.organizations (name) values (clean_name) returning id into new_org;
  insert into public.organization_members (organization_id, user_id, role)
    values (new_org, uid, 'owner');
  update public.users set organization_id = new_org, role = 'owner' where id = uid;
  return new_org;
end;
$$;

create or replace function public.switch_workspace(p_organization_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  member_role text;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select role into member_role
  from public.organization_members
  where organization_id = p_organization_id and user_id = uid;

  if member_role is null then
    raise exception 'You are not a member of that workspace' using errcode = '42501';
  end if;

  update public.users set organization_id = p_organization_id, role = member_role where id = uid;
end;
$$;

-- Invites addressed to the signed-in user's email, with the workspace name they cannot read yet.
create or replace function public.my_pending_invites()
returns table (
  id uuid,
  organization_id uuid,
  organization_name text,
  role text,
  invited_by_name text,
  created_at timestamptz,
  expires_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select i.id, i.organization_id, o.name, i.role, coalesce(u.full_name, ''), i.created_at, i.expires_at
  from public.workspace_invites i
  join public.organizations o on o.id = i.organization_id
  left join public.users u on u.id = i.invited_by
  where i.email = lower((select email from public.users where id = auth.uid()))
    and i.accepted_at is null
    and i.revoked_at is null
    and i.expires_at > now()
  order by i.created_at desc
$$;

create or replace function public.accept_invite(p_invite_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  my_email text;
  inv public.workspace_invites%rowtype;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select lower(email) into my_email from public.users where id = uid;

  select * into inv from public.workspace_invites where id = p_invite_id for update;

  if inv.id is null or inv.email <> my_email then
    raise exception 'Invite not found' using errcode = '42501';
  end if;
  if inv.accepted_at is not null or inv.revoked_at is not null or inv.expires_at <= now() then
    raise exception 'This invite is no longer valid' using errcode = '22023';
  end if;

  -- An existing member keeps their current role.
  insert into public.organization_members (organization_id, user_id, role)
    values (inv.organization_id, uid, inv.role)
    on conflict (organization_id, user_id) do nothing;

  update public.workspace_invites set accepted_at = now() where id = inv.id;

  update public.users u
  set organization_id = inv.organization_id,
      role = (
        select m.role from public.organization_members m
        where m.organization_id = inv.organization_id and m.user_id = uid
      )
  where u.id = uid;

  return inv.organization_id;
end;
$$;

create or replace function public.set_member_role(p_user_id uuid, p_role text)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  org uuid := public.current_org_id();
  owners int;
  target_role text;
begin
  if org is null or public.current_org_role() <> 'owner' then
    raise exception 'Only workspace owners can change roles' using errcode = '42501';
  end if;
  if p_role not in ('owner', 'developer', 'client') then
    raise exception 'Unknown role' using errcode = '22023';
  end if;

  select role into target_role
  from public.organization_members
  where organization_id = org and user_id = p_user_id
  for update;

  if target_role is null then
    raise exception 'That person is not a member of this workspace' using errcode = '22023';
  end if;

  if target_role = 'owner' and p_role <> 'owner' then
    select count(*) into owners
    from public.organization_members
    where organization_id = org and role = 'owner';
    if owners <= 1 then
      raise exception 'A workspace needs at least one owner' using errcode = '22023';
    end if;
  end if;

  update public.organization_members
  set role = p_role
  where organization_id = org and user_id = p_user_id;
end;
$$;

-- Owners can remove anyone; anyone can remove themselves (leave).
create or replace function public.remove_member(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  org uuid := public.current_org_id();
  owners int;
  target_role text;
begin
  if uid is null or org is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if p_user_id <> uid and public.current_org_role() <> 'owner' then
    raise exception 'Only workspace owners can remove members' using errcode = '42501';
  end if;

  select role into target_role
  from public.organization_members
  where organization_id = org and user_id = p_user_id
  for update;

  if target_role is null then
    raise exception 'That person is not a member of this workspace' using errcode = '22023';
  end if;

  if target_role = 'owner' then
    select count(*) into owners
    from public.organization_members
    where organization_id = org and role = 'owner';
    if owners <= 1 then
      raise exception 'A workspace needs at least one owner' using errcode = '22023';
    end if;
  end if;

  delete from public.organization_members
  where organization_id = org and user_id = p_user_id;
end;
$$;

revoke execute on function
  public.create_workspace(text),
  public.switch_workspace(uuid),
  public.my_pending_invites(),
  public.accept_invite(uuid),
  public.set_member_role(uuid, text),
  public.remove_member(uuid),
  public.username_available(text)
from public, anon;

grant execute on function
  public.create_workspace(text),
  public.switch_workspace(uuid),
  public.my_pending_invites(),
  public.accept_invite(uuid),
  public.set_member_role(uuid, text),
  public.remove_member(uuid),
  public.username_available(text)
to authenticated, service_role;

-- ─── 6. Close cross-workspace access ──────────────────────────────────────────

-- 6a. users: a signed-in user could previously set their own role and organization_id, which
-- let them join any workspace as owner. Limit direct writes to profile fields.
revoke insert, update on public.users from anon, authenticated;
grant update (full_name, username, avatar_url, bio, onboarded_at) on public.users to authenticated;

drop policy if exists "Members can read workspace profiles" on public.users;
create policy "Members can read workspace profiles"
  on public.users for select to authenticated
  using (
    id in (
      select m.user_id from public.organization_members m
      where m.organization_id = public.current_org_id()
    )
  );

-- 6b. organizations: every signed-in user could read every workspace and create new ones directly.
drop policy if exists "Authenticated users can read orgs" on public.organizations;
drop policy if exists "Authenticated users can insert orgs" on public.organizations;

drop policy if exists "Members can read their workspaces" on public.organizations;
create policy "Members can read their workspaces"
  on public.organizations for select to authenticated
  using (
    id in (select m.organization_id from public.organization_members m where m.user_id = auth.uid())
  );

drop policy if exists "Owners can update their workspace" on public.organizations;
create policy "Owners can update their workspace"
  on public.organizations for update to authenticated
  using (id = public.current_org_id() and public.current_org_role() = 'owner')
  with check (id = public.current_org_id() and public.current_org_role() = 'owner');

-- 6c. reports and report_folders: readable and writable by every signed-in user of any workspace.
drop policy if exists "Authenticated users can read reports" on public.reports;
drop policy if exists "Authenticated users can insert reports" on public.reports;
drop policy if exists "Authenticated users can update reports" on public.reports;
drop policy if exists "Authenticated users can delete reports" on public.reports;

drop policy if exists "Org users can read reports" on public.reports;
create policy "Org users can read reports"
  on public.reports for select to authenticated
  using (project_id in (
    select p.id from public.projects p where p.organization_id = public.current_org_id()
  ));

drop policy if exists "Staff can manage reports" on public.reports;
create policy "Staff can manage reports"
  on public.reports for all to authenticated
  using (public.is_org_staff() and project_id in (
    select p.id from public.projects p where p.organization_id = public.current_org_id()
  ))
  with check (public.is_org_staff() and project_id in (
    select p.id from public.projects p where p.organization_id = public.current_org_id()
  ));

drop policy if exists "Authenticated users can read report_folders" on public.report_folders;
drop policy if exists "Authenticated users can insert report_folders" on public.report_folders;
drop policy if exists "Authenticated users can update report_folders" on public.report_folders;
drop policy if exists "Authenticated users can delete report_folders" on public.report_folders;

drop policy if exists "Org users can read report_folders" on public.report_folders;
create policy "Org users can read report_folders"
  on public.report_folders for select to authenticated
  using (project_id in (
    select p.id from public.projects p where p.organization_id = public.current_org_id()
  ));

drop policy if exists "Staff can manage report_folders" on public.report_folders;
create policy "Staff can manage report_folders"
  on public.report_folders for all to authenticated
  using (public.is_org_staff() and project_id in (
    select p.id from public.projects p where p.organization_id = public.current_org_id()
  ))
  with check (public.is_org_staff() and project_id in (
    select p.id from public.projects p where p.organization_id = public.current_org_id()
  ));

-- 6d. api_keys: key hashes were readable, and keys creatable, by every signed-in user.
drop policy if exists "Authenticated users can read api_keys" on public.api_keys;
drop policy if exists "Authenticated users can insert api_keys" on public.api_keys;
drop policy if exists "Authenticated users can update api_keys" on public.api_keys;
drop policy if exists "Authenticated users can delete api_keys" on public.api_keys;

drop policy if exists "Staff can manage api_keys" on public.api_keys;
create policy "Staff can manage api_keys"
  on public.api_keys for all to authenticated
  using (public.is_org_staff() and project_id in (
    select p.id from public.projects p where p.organization_id = public.current_org_id()
  ))
  with check (public.is_org_staff() and project_id in (
    select p.id from public.projects p where p.organization_id = public.current_org_id()
  ));

-- 6e. github_webhook_events: the policy allowed every role, including logged-out visitors.
-- The service role bypasses RLS, so no policy is needed for the webhook handler.
drop policy if exists "Service role manages webhook_events" on public.github_webhook_events;

-- 6f. Integration tables hold access tokens; only staff should be able to read them.
-- ("Staff can manage project_integrations_github" already covers staff reads.)
drop policy if exists "Org users can read project_integrations_github" on public.project_integrations_github;
drop policy if exists "Org users can read project_integrations_railway" on public.project_integrations_railway;

drop policy if exists "Staff can read project_integrations_railway" on public.project_integrations_railway;
create policy "Staff can read project_integrations_railway"
  on public.project_integrations_railway for select to authenticated
  using (public.is_org_staff() and project_id in (
    select p.id from public.projects p where p.organization_id = public.current_org_id()
  ));

-- ─── 7. Profile pictures ──────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists "Users can read own avatar files" on storage.objects;
create policy "Users can read own avatar files"
  on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can upload own avatar" on storage.objects;
create policy "Users can upload own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can replace own avatar" on storage.objects;
create policy "Users can replace own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete own avatar" on storage.objects;
create policy "Users can delete own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

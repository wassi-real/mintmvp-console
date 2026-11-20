-- MintMVP Console rebuild, part 2: project management additions.
--
-- Additive only. Existing rows keep their values; new columns are nullable or have defaults.

-- ─── Projects: description, priority, target date, two more statuses ──────────

alter table public.projects
  add column if not exists description text not null default '',
  add column if not exists priority text not null default 'medium',
  add column if not exists target_date date,
  add column if not exists updated_at timestamptz not null default now();

alter table public.projects drop constraint if exists projects_priority_check;
alter table public.projects add constraint projects_priority_check
  check (priority in ('low', 'medium', 'high'));

-- Superset of the previous list ('active', 'maintenance', 'paused').
alter table public.projects drop constraint if exists projects_status_check;
alter table public.projects add constraint projects_status_check
  check (status in ('active', 'maintenance', 'paused', 'completed', 'archived'));

drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at
  before update on public.projects
  for each row execute procedure public.set_updated_at();

-- ─── Tasks: subtasks, assignee, deadline, labels, ordering ────────────────────

alter table public.tasks
  add column if not exists parent_task_id uuid references public.tasks(id) on delete cascade,
  add column if not exists assignee_user_id uuid references public.users(id) on delete set null,
  add column if not exists created_by uuid references public.users(id) on delete set null,
  add column if not exists due_date date,
  add column if not exists labels text[] not null default '{}',
  add column if not exists sort_order integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

alter table public.tasks drop constraint if exists tasks_not_own_parent;
alter table public.tasks add constraint tasks_not_own_parent
  check (parent_task_id is null or parent_task_id <> id);

create index if not exists idx_tasks_parent on public.tasks(parent_task_id);
create index if not exists idx_tasks_assignee_user on public.tasks(assignee_user_id);
create index if not exists idx_tasks_due_date on public.tasks(project_id, due_date);

drop trigger if exists tasks_updated_at on public.tasks;
create trigger tasks_updated_at
  before update on public.tasks
  for each row execute procedure public.set_updated_at();

-- ─── Task dependencies ("this task waits for that task") ──────────────────────

create table if not exists public.task_dependencies (
  task_id uuid not null references public.tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

create index if not exists idx_task_dependencies_depends_on
  on public.task_dependencies(depends_on_task_id);

alter table public.task_dependencies enable row level security;

drop policy if exists "Org users can read task_dependencies" on public.task_dependencies;
create policy "Org users can read task_dependencies"
  on public.task_dependencies for select to authenticated
  using (task_id in (
    select t.id from public.tasks t
    join public.projects p on p.id = t.project_id
    where p.organization_id = public.current_org_id()
  ));

drop policy if exists "Staff can manage task_dependencies" on public.task_dependencies;
create policy "Staff can manage task_dependencies"
  on public.task_dependencies for all to authenticated
  using (public.is_org_staff() and task_id in (
    select t.id from public.tasks t
    join public.projects p on p.id = t.project_id
    where p.organization_id = public.current_org_id()
  ))
  with check (
    public.is_org_staff()
    and task_id in (
      select t.id from public.tasks t
      join public.projects p on p.id = t.project_id
      where p.organization_id = public.current_org_id()
    )
    and depends_on_task_id in (
      select t.id from public.tasks t
      join public.projects p on p.id = t.project_id
      where p.organization_id = public.current_org_id()
    )
  );

-- ─── Task comments (every workspace member, including clients, can comment) ───

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  author_user_id uuid references public.users(id) on delete set null,
  author_name text not null default '',
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

create index if not exists idx_task_comments_task on public.task_comments(task_id, created_at);

alter table public.task_comments enable row level security;

drop policy if exists "Org users can read task_comments" on public.task_comments;
create policy "Org users can read task_comments"
  on public.task_comments for select to authenticated
  using (task_id in (
    select t.id from public.tasks t
    join public.projects p on p.id = t.project_id
    where p.organization_id = public.current_org_id()
  ));

drop policy if exists "Org users can add task_comments" on public.task_comments;
create policy "Org users can add task_comments"
  on public.task_comments for insert to authenticated
  with check (
    author_user_id = auth.uid()
    and task_id in (
      select t.id from public.tasks t
      join public.projects p on p.id = t.project_id
      where p.organization_id = public.current_org_id()
    )
  );

drop policy if exists "Authors can delete own task_comments" on public.task_comments;
create policy "Authors can delete own task_comments"
  on public.task_comments for delete to authenticated
  using (
    task_id in (
      select t.id from public.tasks t
      join public.projects p on p.id = t.project_id
      where p.organization_id = public.current_org_id()
    )
    and (author_user_id = auth.uid() or public.current_org_role() = 'owner')
  );

-- ─── Notifications ────────────────────────────────────────────────────────────

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  kind text not null,
  title text not null check (char_length(title) between 1 and 300),
  body text not null default '',
  link text not null default '',
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_notifications_user on public.notifications(user_id, created_at desc);
create index if not exists idx_notifications_unread
  on public.notifications(user_id) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can delete own notifications"
  on public.notifications for delete to authenticated
  using (user_id = auth.uid());

-- A member can notify other members of the workspace they are working in, as themselves.
drop policy if exists "Members can notify workspace members" on public.notifications;
create policy "Members can notify workspace members"
  on public.notifications for insert to authenticated
  with check (
    created_by = auth.uid()
    and organization_id = public.current_org_id()
    and user_id in (
      select m.user_id from public.organization_members m
      where m.organization_id = public.current_org_id()
    )
  );

-- Only read_at may be changed after a notification is created.
revoke update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

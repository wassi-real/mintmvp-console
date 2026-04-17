-- Replace FOR ALL policy with explicit INSERT/UPDATE/DELETE so Supabase upserts work reliably under RLS.

drop policy if exists "Staff can manage project_integrations_railway" on public.project_integrations_railway;

create policy "Staff can insert project_integrations_railway"
  on public.project_integrations_railway for insert
  with check (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid() and u.role in ('owner', 'developer')
  ));

create policy "Staff can update project_integrations_railway"
  on public.project_integrations_railway for update
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid() and u.role in ('owner', 'developer')
  ))
  with check (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid() and u.role in ('owner', 'developer')
  ));

create policy "Staff can delete project_integrations_railway"
  on public.project_integrations_railway for delete
  using (project_id in (
    select p.id from public.projects p
    join public.users u on u.organization_id = p.organization_id
    where u.id = auth.uid() and u.role in ('owner', 'developer')
  ));

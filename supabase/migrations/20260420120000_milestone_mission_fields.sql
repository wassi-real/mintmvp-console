-- Milestones as mini-projects: lifecycle gates, test gate, risks, deliverables, approval owner,
-- expanded slices (notes, owner, estimate, dependency), and new phase flow.

-- Phase: replace legacy values with mission-style flow
alter table public.milestones drop constraint if exists milestones_phase_check;

update public.milestones set phase = case phase
  when 'planned' then 'discovery'
  when 'scoping' then 'planning'
  when 'in_progress' then 'execution'
  when 'testing' then 'internal_testing'
  when 'review' then 'client_review'
  when 'complete' then 'approved'
  when 'blocked' then 'blocked'
  else 'discovery'
end;

alter table public.milestones add constraint milestones_phase_check check (phase in (
  'discovery',
  'planning',
  'execution',
  'internal_testing',
  'client_review',
  'approved',
  'released',
  'blocked',
  'closed'
));

alter table public.milestones
  add column if not exists entry_gate text not null default '',
  add column if not exists exit_gate text not null default '',
  add column if not exists test_gate_required_tests text not null default '',
  add column if not exists test_gate_pass_threshold text not null default '',
  add column if not exists test_gate_environment text not null default '',
  add column if not exists dependencies text not null default '',
  add column if not exists risks_blockers text not null default '',
  add column if not exists deliverables text not null default '',
  add column if not exists approval_owner_user_id uuid references public.users(id) on delete set null;

create index if not exists idx_milestones_approval_owner on public.milestones(approval_owner_user_id);

-- Slices: richer structure
alter table public.milestone_slices drop constraint if exists milestone_slices_status_check;

update public.milestone_slices set status = 'pending' where status = 'todo';

alter table public.milestone_slices
  add column if not exists notes text not null default '',
  add column if not exists owner_user_id uuid references public.users(id) on delete set null,
  add column if not exists estimate text not null default '',
  add column if not exists depends_on text;

alter table public.milestone_slices add constraint milestone_slices_status_check check (status in (
  'pending',
  'todo',
  'in_progress',
  'done',
  'blocked'
));

create index if not exists idx_milestone_slices_owner on public.milestone_slices(owner_user_id);

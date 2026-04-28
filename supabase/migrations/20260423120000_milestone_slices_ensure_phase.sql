-- Ensure milestone_slices.phase exists (fixes DBs where 20260421120000 was skipped or failed remotely).

alter table public.milestone_slices
  add column if not exists phase text not null default 'discovery';

update public.milestone_slices s
set phase = m.phase
from public.milestones m
where s.milestone_id = m.id;

alter table public.milestone_slices drop constraint if exists milestone_slices_phase_check;

alter table public.milestone_slices add constraint milestone_slices_phase_check check (phase in (
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

create index if not exists idx_milestone_slices_milestone_phase on public.milestone_slices(milestone_id, phase);

-- Slice-level schedule: start + deadline (estimates remain on text `estimate`)

alter table public.milestone_slices
  add column if not exists start_date date,
  add column if not exists deadline date;

create index if not exists idx_milestone_slices_deadline on public.milestone_slices(milestone_id, deadline);
create index if not exists idx_milestone_slices_start on public.milestone_slices(milestone_id, start_date);

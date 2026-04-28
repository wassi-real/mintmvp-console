-- Store slice start / deadline as free-form text (paste-friendly, not only YYYY-MM-DD)

alter table public.milestone_slices
  alter column start_date type text using (
    case when start_date is null then null else start_date::text end
  );

alter table public.milestone_slices
  alter column deadline type text using (
    case when deadline is null then null else deadline::text end
  );

-- Rich GitHub deployment / status feedback for monitoring (logs, URLs, creator)

alter table public.deployment_observations
  add column if not exists github_status_detail text,
  add column if not exists environment_url text,
  add column if not exists log_url text,
  add column if not exists target_url text,
  add column if not exists creator_login text;

-- Demo seed data for MintMVP Console
-- Run after the migration and after creating a user via Supabase Auth.
-- Replace the UUIDs below with your own org/project ids if desired.

-- Demo organization
insert into public.organizations (id, name) values
  ('a0000000-0000-0000-0000-000000000001', 'Acme Corp');

-- Demo project
insert into public.projects (id, organization_id, name, repo_url, staging_url, production_url, status) values
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
   'Trivia App', 'https://github.com/acme/trivia-app',
   'https://staging.trivia.acme.com', 'https://trivia.acme.com', 'active');

-- Demo specs
insert into public.specs (project_id, title, summary, goal, acceptance_criteria, edge_cases, regression_risks, status) values
  ('b0000000-0000-0000-0000-000000000001', 'Scoring System', 'Implement trivia scoring', 'Accurate point tracking per round', 'Points increment on correct answer; no change on wrong', 'Tie-breaking edge case', 'Could affect leaderboard', 'in_dev'),
  ('b0000000-0000-0000-0000-000000000001', 'User Registration', 'Allow users to create accounts', 'Secure signup with email verification', 'User can sign up, verify email, and log in', 'Duplicate email handling', 'None identified', 'completed'),
  ('b0000000-0000-0000-0000-000000000001', 'Leaderboard', 'Display top players', 'Show ranked list of top scorers', 'Top 10 players visible; updates in real-time', 'Tied scores display order', 'Scoring changes could break rankings', 'draft');

-- Demo tasks
insert into public.tasks (project_id, title, description, status, priority, assignee) values
  ('b0000000-0000-0000-0000-000000000001', 'Fix score calculation bug', 'Points not incrementing on rapid answers', 'in_progress', 'high', 'Alex'),
  ('b0000000-0000-0000-0000-000000000001', 'Add round timer UI', 'Display countdown timer for each round', 'in_progress', 'medium', 'Jordan'),
  ('b0000000-0000-0000-0000-000000000001', 'Write signup validation tests', 'Unit tests for email/password validation', 'testing', 'medium', 'Alex'),
  ('b0000000-0000-0000-0000-000000000001', 'Design leaderboard mockup', 'Create Figma mockup for leaderboard page', 'backlog', 'low', null),
  ('b0000000-0000-0000-0000-000000000001', 'Deploy v0.2.3 hotfix', 'Scoring fix deployment', 'deployed', 'high', 'Jordan'),
  ('b0000000-0000-0000-0000-000000000001', 'API rate limiting', 'Add rate limits to public endpoints', 'review', 'medium', 'Alex');

-- Demo tests
insert into public.tests (project_id, name, type, status, last_run, notes) values
  ('b0000000-0000-0000-0000-000000000001', 'Signup flow test', 'integration', 'pass', now() - interval '2 hours', 'All assertions passing'),
  ('b0000000-0000-0000-0000-000000000001', 'Score logic test', 'unit', 'pass', now() - interval '1 hour', 'Fixed after v0.2.3'),
  ('b0000000-0000-0000-0000-000000000001', 'Round restart test', 'integration', 'pass', now() - interval '3 hours', null),
  ('b0000000-0000-0000-0000-000000000001', 'Leaderboard load test', 'smoke', 'pending', null, 'Not yet implemented'),
  ('b0000000-0000-0000-0000-000000000001', 'Payment webhook test', 'manual', 'fail', now() - interval '1 day', 'Timeout on webhook callback');

-- Demo deployments
insert into public.deployments (project_id, environment, version, status, notes, created_at) values
  ('b0000000-0000-0000-0000-000000000001', 'production', 'v0.2.3', 'success', 'Scoring fix', now() - interval '2 hours'),
  ('b0000000-0000-0000-0000-000000000001', 'staging', 'v0.2.4-beta', 'success', 'Leaderboard WIP', now() - interval '30 minutes'),
  ('b0000000-0000-0000-0000-000000000001', 'production', 'v0.2.2', 'success', 'Registration improvements', now() - interval '3 days'),
  ('b0000000-0000-0000-0000-000000000001', 'staging', 'v0.2.2-beta', 'failed', 'Build error', now() - interval '4 days');

-- Demo incidents
insert into public.incidents (project_id, title, severity, status, description, created_at, resolved_at) values
  ('b0000000-0000-0000-0000-000000000001', 'Score not updating', 'high', 'resolved', 'Rapid answer submissions caused race condition', now() - interval '1 day', now() - interval '2 hours'),
  ('b0000000-0000-0000-0000-000000000001', 'Slow page load on leaderboard', 'medium', 'investigating', 'Page takes 5s+ to load with 1000+ entries', now() - interval '6 hours', null);

-- Demo activity log
insert into public.activity_log (project_id, action, actor, metadata, created_at) values
  ('b0000000-0000-0000-0000-000000000001', 'Spec created', 'Alex', '{"spec": "Scoring System"}', now() - interval '5 days'),
  ('b0000000-0000-0000-0000-000000000001', 'Task moved to in_progress', 'Alex', '{"task": "Fix score calculation bug"}', now() - interval '2 days'),
  ('b0000000-0000-0000-0000-000000000001', 'Unit test added', 'Jordan', '{"test": "Score logic test"}', now() - interval '1 day'),
  ('b0000000-0000-0000-0000-000000000001', 'Deployment v0.2.3 pushed', 'Jordan', '{"version": "v0.2.3", "env": "production"}', now() - interval '2 hours'),
  ('b0000000-0000-0000-0000-000000000001', 'Smoke test passed', 'Alex', '{"test": "Round restart test"}', now() - interval '1 hour'),
  ('b0000000-0000-0000-0000-000000000001', 'Bug reported', 'Client', '{"incident": "Slow page load on leaderboard"}', now() - interval '6 hours'),
  ('b0000000-0000-0000-0000-000000000001', 'Incident resolved', 'Alex', '{"incident": "Score not updating"}', now() - interval '2 hours');

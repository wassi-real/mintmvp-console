import { projectContext } from '#lib/server/context.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { supabase, project } = await projectContext(event);

	const [runs, connection] = await Promise.all([
		supabase
			.from('github_ci_runs')
			.select('id, workflow_name, branch, commit_sha, status, created_at, gh_run_id')
			.eq('project_id', project.id)
			.order('created_at', { ascending: false })
			.limit(300),
		supabase
			.from('project_integrations_github')
			.select('repo_owner, repo_name')
			.eq('project_id', project.id)
			.maybeSingle()
	]);

	const all = runs.data ?? [];
	const repo = connection.data;
	return {
		runs: all,
		repoUrl: repo ? `https://github.com/${repo.repo_owner}/${repo.repo_name}` : '',
		counts: {
			total: all.length,
			passed: all.filter((run) => run.status === 'success').length,
			failed: all.filter((run) => run.status === 'failure').length,
			running: all.filter((run) => run.status === 'in_progress' || run.status === 'pending').length
		}
	};
};

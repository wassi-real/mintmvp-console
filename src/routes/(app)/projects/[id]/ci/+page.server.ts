import type { PageServerLoad } from './$types';
import type { Tables } from '$lib/supabase/types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const [
		{ data: ciRuns },
		{ data: ghDeployments },
		{ data: integration }
	] = await Promise.all([
		locals.supabase
			.from('github_ci_runs')
			.select('*')
			.eq('project_id', params.id)
			.order('created_at', { ascending: false }),
		locals.supabase
			.from('github_deployments')
			.select('*')
			.eq('project_id', params.id)
			.order('created_at', { ascending: false }),
		locals.supabase
			.from('project_integrations_github')
			.select('repo_owner, repo_name')
			.eq('project_id', params.id)
			.maybeSingle()
	]);

	return {
		ciRuns: (ciRuns ?? []) as Tables<'github_ci_runs'>[],
		ghDeployments: (ghDeployments ?? []) as Tables<'github_deployments'>[],
		integration: integration as { repo_owner: string; repo_name: string } | null
	};
};

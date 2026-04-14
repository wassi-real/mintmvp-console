import type { PageServerLoad } from './$types';
import type { Tables } from '$lib/supabase/types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const [
		{ data: integration },
		{ data: branches },
		{ data: pullRequests },
		{ data: commits }
	] = await Promise.all([
		locals.supabase
			.from('project_integrations_github')
			.select('*')
			.eq('project_id', params.id)
			.maybeSingle(),
		locals.supabase
			.from('github_branches')
			.select('*')
			.eq('project_id', params.id)
			.order('updated_at', { ascending: false }),
		locals.supabase
			.from('github_pull_requests')
			.select('*')
			.eq('project_id', params.id)
			.order('created_at', { ascending: false }),
		locals.supabase
			.from('github_commits')
			.select('*')
			.eq('project_id', params.id)
			.order('committed_at', { ascending: false })
			.limit(500)
	]);

	return {
		integration: integration as Tables<'project_integrations_github'> | null,
		branches: (branches ?? []) as Tables<'github_branches'>[],
		pullRequests: (pullRequests ?? []) as Tables<'github_pull_requests'>[],
		commits: (commits ?? []) as Tables<'github_commits'>[]
	};
};

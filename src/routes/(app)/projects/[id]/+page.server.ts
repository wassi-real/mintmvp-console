import type { PageServerLoad } from './$types';
import type { Tables } from '$lib/supabase/types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const { supabase } = locals;
	const projectId = params.id;

	const [
		specsRes, tasksRes, testsRes, deploymentsRes, incidentsRes, activityRes,
		healthRes, envsRes, commitsRes, branchesRes
	] = await Promise.all([
		supabase.from('specs').select('id, status').eq('project_id', projectId),
		supabase.from('tasks').select('id, status').eq('project_id', projectId),
		supabase.from('tests').select('id, status').eq('project_id', projectId),
		supabase
			.from('deployments')
			.select('*')
			.eq('project_id', projectId)
			.order('created_at', { ascending: false })
			.limit(5),
		supabase.from('incidents').select('id, status').eq('project_id', projectId),
		supabase
			.from('activity_log')
			.select('*')
			.eq('project_id', projectId)
			.order('created_at', { ascending: false })
			.limit(5),
		supabase.from('project_health').select('*').eq('project_id', projectId).maybeSingle(),
		supabase.from('project_environments').select('*').eq('project_id', projectId).order('kind'),
		supabase.from('code_commits').select('id, status').eq('project_id', projectId),
		supabase.from('repo_branches').select('id, status').eq('project_id', projectId)
	]);

	const specs = (specsRes.data ?? []) as any[];
	const tasks = (tasksRes.data ?? []) as any[];
	const tests = (testsRes.data ?? []) as any[];
	const deployments = (deploymentsRes.data ?? []) as Tables<'deployments'>[];
	const incidents = (incidentsRes.data ?? []) as any[];
	const recentActivity = (activityRes.data ?? []) as Tables<'activity_log'>[];
	const health = healthRes.data as Tables<'project_health'> | null;
	const environments = (envsRes.data ?? []) as Tables<'project_environments'>[];
	const commits = (commitsRes.data ?? []) as any[];
	const branches = (branchesRes.data ?? []) as any[];

	return {
		stats: {
			specs: specs.length,
			totalTasks: tasks.length,
			tasksInProgress: tasks.filter((t) => t.status === 'in_progress').length,
			tasksInTesting: tasks.filter((t) => t.status === 'testing').length,
			tasksDeployed: tasks.filter((t) => t.status === 'deployed').length,
			testsTotal: tests.length,
			testsPassing: tests.filter((t) => t.status === 'pass').length,
			testsFailing: tests.filter((t) => t.status === 'fail').length,
			openIncidents: incidents.filter((i) => i.status !== 'resolved').length,
			totalIncidents: incidents.length,
			commits: commits.length,
			commitsMerged: commits.filter((c) => c.status === 'merged').length,
			branches: branches.length,
			branchesStable: branches.filter((b) => b.status === 'stable').length
		},
		health,
		environments,
		recentDeploys: deployments,
		recentActivity
	};
};

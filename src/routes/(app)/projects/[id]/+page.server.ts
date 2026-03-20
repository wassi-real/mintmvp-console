import type { PageServerLoad } from './$types';
import type { Tables } from '$lib/supabase/types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const { supabase } = locals;
	const projectId = params.id;

	const [specsRes, tasksRes, testsRes, deploymentsRes, incidentsRes, activityRes] =
		await Promise.all([
			supabase.from('specs').select('*').eq('project_id', projectId),
			supabase.from('tasks').select('*').eq('project_id', projectId),
			supabase.from('tests').select('*').eq('project_id', projectId),
			supabase
				.from('deployments')
				.select('*')
				.eq('project_id', projectId)
				.order('created_at', { ascending: false })
				.limit(3),
			supabase.from('incidents').select('*').eq('project_id', projectId),
			supabase
				.from('activity_log')
				.select('*')
				.eq('project_id', projectId)
				.order('created_at', { ascending: false })
				.limit(5)
		]);

	const specs = (specsRes.data ?? []) as Tables<'specs'>[];
	const tasks = (tasksRes.data ?? []) as Tables<'tasks'>[];
	const tests = (testsRes.data ?? []) as Tables<'tests'>[];
	const deployments = (deploymentsRes.data ?? []) as Tables<'deployments'>[];
	const incidents = (incidentsRes.data ?? []) as Tables<'incidents'>[];
	const recentActivity = (activityRes.data ?? []) as Tables<'activity_log'>[];

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
			totalIncidents: incidents.length
		},
		recentDeploys: deployments,
		recentActivity
	};
};

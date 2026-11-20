import { MILESTONE_DONE_PHASES } from '#lib/constants.ts';
import { projectContext } from '#lib/server/context.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { supabase, project } = await projectContext(event);
	const id = project.id;

	const [tasks, milestones, incidents, health, environments, activity, tests] = await Promise.all([
		supabase.from('tasks').select('status, due_date').eq('project_id', id).limit(5000),
		supabase
			.from('milestones')
			.select('id, title, phase, due_date')
			.eq('project_id', id)
			.order('due_date', { nullsFirst: false }),
		supabase
			.from('incidents')
			.select('id, title, severity, status, created_at')
			.eq('project_id', id)
			.neq('status', 'resolved')
			.order('created_at', { ascending: false })
			.limit(5),
		supabase.from('project_health').select('*').eq('project_id', id).maybeSingle(),
		supabase
			.from('project_environments')
			.select('id, kind, status, url, current_version, last_deploy_at')
			.eq('project_id', id),
		supabase
			.from('activity_log')
			.select('id, action, actor, created_at')
			.eq('project_id', id)
			.order('created_at', { ascending: false })
			.limit(8),
		supabase.from('tests').select('status').eq('project_id', id).limit(5000)
	]);

	const today = new Date().toISOString().slice(0, 10);
	const allTasks = tasks.data ?? [];
	const taskCounts: Record<string, number> = {};
	for (const task of allTasks) taskCounts[task.status] = (taskCounts[task.status] ?? 0) + 1;

	const allMilestones = milestones.data ?? [];
	const testCounts = { pass: 0, fail: 0, pending: 0 };
	for (const test of tests.data ?? []) {
		if (test.status === 'pass' || test.status === 'fail' || test.status === 'pending') {
			testCounts[test.status] += 1;
		}
	}

	const kinds = ['production', 'staging', 'development'];
	return {
		taskCounts,
		totalTasks: allTasks.length,
		doneTasks: taskCounts.deployed ?? 0,
		overdueTasks: allTasks.filter(
			(task) => task.status !== 'deployed' && task.due_date && task.due_date < today
		).length,
		milestonesDone: allMilestones.filter((m) => MILESTONE_DONE_PHASES.has(m.phase)).length,
		milestonesTotal: allMilestones.length,
		nextMilestones: allMilestones.filter((m) => !MILESTONE_DONE_PHASES.has(m.phase)).slice(0, 5),
		incidents: incidents.data ?? [],
		health: health.data,
		environments: (environments.data ?? []).sort(
			(a, b) => kinds.indexOf(a.kind) - kinds.indexOf(b.kind)
		),
		activity: activity.data ?? [],
		testCounts
	};
};

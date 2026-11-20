import { MILESTONE_DONE_PHASES } from '#lib/constants.ts';
import { workspaceContext } from '#lib/server/context.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { supabase, profile } = workspaceContext(event);

	const { data: projects } = await supabase
		.from('projects')
		.select('id, name, status, priority, target_date, description')
		.eq('organization_id', profile.organization_id)
		.order('name');

	const all = projects ?? [];
	const ids = all.map((project) => project.id);
	if (ids.length === 0) {
		return { projects: [], myTasks: [], incidents: [], milestones: [], activity: [], totals: null };
	}

	const [tasks, incidents, milestones, activity] = await Promise.all([
		supabase
			.from('tasks')
			.select('id, title, status, priority, due_date, project_id, assignee_user_id')
			.in('project_id', ids)
			.neq('status', 'deployed')
			.limit(2000),
		supabase
			.from('incidents')
			.select('id, title, severity, status, project_id, created_at')
			.in('project_id', ids)
			.neq('status', 'resolved')
			.order('created_at', { ascending: false })
			.limit(20),
		supabase
			.from('milestones')
			.select('id, title, phase, due_date, project_id')
			.in('project_id', ids)
			.not('due_date', 'is', null)
			.order('due_date')
			.limit(200),
		supabase
			.from('activity_log')
			.select('id, action, actor, created_at, project_id')
			.in('project_id', ids)
			.order('created_at', { ascending: false })
			.limit(10)
	]);

	const names = new Map(all.map((project) => [project.id, project.name]));
	const open = tasks.data ?? [];
	const today = new Date().toISOString().slice(0, 10);

	const openByProject = new Map<string, number>();
	for (const task of open) {
		openByProject.set(task.project_id, (openByProject.get(task.project_id) ?? 0) + 1);
	}

	const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
	const myTasks = open
		.filter((task) => task.assignee_user_id === profile.id)
		.sort(
			(a, b) =>
				(a.due_date ?? '9999').localeCompare(b.due_date ?? '9999') ||
				(priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9)
		)
		.slice(0, 8)
		.map((task) => ({ ...task, projectName: names.get(task.project_id) ?? '' }));

	const upcoming = (milestones.data ?? [])
		.filter((milestone) => !MILESTONE_DONE_PHASES.has(milestone.phase))
		.slice(0, 6)
		.map((milestone) => ({ ...milestone, projectName: names.get(milestone.project_id) ?? '' }));

	return {
		projects: all
			.filter((project) => project.status !== 'archived')
			.map((project) => ({ ...project, openTasks: openByProject.get(project.id) ?? 0 })),
		myTasks,
		incidents: (incidents.data ?? []).map((incident) => ({
			...incident,
			projectName: names.get(incident.project_id) ?? ''
		})),
		milestones: upcoming,
		activity: (activity.data ?? []).map((entry) => ({
			...entry,
			projectName: names.get(entry.project_id) ?? ''
		})),
		totals: {
			activeProjects: all.filter((project) => project.status === 'active').length,
			openTasks: open.length,
			overdueTasks: open.filter((task) => task.due_date && task.due_date < today).length,
			openIncidents: (incidents.data ?? []).length
		}
	};
};

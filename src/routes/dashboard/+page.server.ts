import { workspaceContext } from '#lib/server/context.ts';
import { needsAcross } from '#lib/server/work.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { supabase, profile } = workspaceContext(event);

	const { data: projects } = await supabase
		.from('projects')
		.select('id, name, status, description')
		.eq('organization_id', profile.organization_id)
		.neq('status', 'archived')
		.order('name');

	const all = projects ?? [];
	const ids = all.map((project) => project.id);
	if (ids.length === 0) {
		return { projects: [], needs: [], workReady: true, activity: [], projectNames: {} };
	}

	const [work, activity] = await Promise.all([
		needsAcross(supabase, ids),
		supabase
			.from('activity_log')
			.select('id, action, actor, created_at, project_id')
			.in('project_id', ids)
			.order('created_at', { ascending: false })
			.limit(8)
	]);

	const projectNames = Object.fromEntries(all.map((project) => [project.id, project.name]));
	const needsByProject = new Map<string, number>();
	for (const need of work.needs) needsByProject.set(need.projectId, (needsByProject.get(need.projectId) ?? 0) + 1);

	return {
		projects: all.map((project) => ({
			...project,
			needs: needsByProject.get(project.id) ?? 0,
			moving: work.moving.get(project.id) ?? 0
		})),
		needs: work.needs,
		workReady: work.ready,
		activity: activity.data ?? [],
		projectNames
	};
};

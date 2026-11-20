import { projectContext } from '#lib/server/context.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const { supabase, project } = await projectContext(event);

	const [openTasks, openIncidents] = await Promise.all([
		supabase
			.from('tasks')
			.select('id', { count: 'exact', head: true })
			.eq('project_id', project.id)
			.neq('status', 'deployed'),
		supabase
			.from('incidents')
			.select('id', { count: 'exact', head: true })
			.eq('project_id', project.id)
			.neq('status', 'resolved')
	]);

	return {
		project,
		counts: { tasks: openTasks.count ?? 0, incidents: openIncidents.count ?? 0 }
	};
};

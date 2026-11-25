import { projectContext } from '#lib/server/context.ts';
import { appScope, workActions } from '#lib/server/work-actions.ts';
import { board } from '#lib/server/work.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const context = await projectContext(event);
	const [today, keys] = await Promise.all([
		board(appScope(context).scope),
		context.supabase.from('api_keys').select('id', { count: 'exact', head: true }).eq('project_id', context.project.id)
	]);
	return {
		board: today,
		hasAgentKey: (keys.count ?? 0) > 0
	};
};

export const actions: Actions = {
	approve: workActions.approve,
	accept: workActions.accept,
	decide: workActions.decide,
	handoff: workActions.handoff
};

import type { LayoutServerLoad } from './$types';
import { loadMilestoneWorkspace } from '$lib/server/milestone-shared';

export const load: LayoutServerLoad = async ({ locals, params }) => {
	return await loadMilestoneWorkspace(locals.supabase, params.id);
};

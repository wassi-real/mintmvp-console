import { projectContext } from '#lib/server/context.ts';
import { needsAcross } from '#lib/server/work.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const { supabase, project } = await projectContext(event);
	const work = await needsAcross(supabase, [project.id]);

	return {
		project,
		counts: {
			needsYou: work.needs.length,
			moving: work.moving.get(project.id) ?? 0
		}
	};
};

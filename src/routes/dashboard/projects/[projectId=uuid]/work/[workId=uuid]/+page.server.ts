import { error } from '@sveltejs/kit';
import { projectContext } from '#lib/server/context.ts';
import { appScope, workActions } from '#lib/server/work-actions.ts';
import { workDetail } from '#lib/server/work.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const context = await projectContext(event);
	const detail = await workDetail(appScope(context).scope, event.params.workId);
	if (!detail.ok) error(detail.status, detail.error);
	return { ...detail.value };
};

export const actions: Actions = {
	edit: workActions.edit,
	approve: workActions.approve,
	decide: workActions.decide,
	accept: workActions.accept,
	check: workActions.check,
	scope: workActions.scope,
	release: workActions.release,
	reopen: workActions.reopen,
	handoff: workActions.handoff,
	note: workActions.note,
	drop: workActions.drop
};

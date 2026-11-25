import { projectContext } from '#lib/server/context.ts';
import { appScope, workActions } from '#lib/server/work-actions.ts';
import { listWork } from '#lib/server/work.ts';
import type { Actions, PageServerLoad } from './$types';

const FILTERS = ['open', 'released', 'dropped', 'all'] as const;
type Filter = (typeof FILTERS)[number];

export const load: PageServerLoad = async (event) => {
	const context = await projectContext(event);
	const requested = event.url.searchParams.get('show') as Filter | null;
	const show: Filter = requested && FILTERS.includes(requested) ? requested : 'open';
	const listed = await listWork(appScope(context).scope, {
		open: show === 'open',
		state: show === 'released' || show === 'dropped' ? show : undefined,
		limit: 200
	});
	return {
		show,
		ready: listed.ok || listed.status !== 503,
		items: listed.ok ? listed.value.items : [],
		count: listed.ok ? listed.value.count : 0
	};
};

export const actions: Actions = {
	create: workActions.create
};

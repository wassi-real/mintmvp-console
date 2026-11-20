import { projectContext } from '#lib/server/context.ts';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 100;

export const load: PageServerLoad = async (event) => {
	const { supabase, project } = await projectContext(event);
	const page = Math.max(1, Number(event.url.searchParams.get('page')) || 1);
	const from = (page - 1) * PAGE_SIZE;

	const { data, count } = await supabase
		.from('activity_log')
		.select('id, action, actor, created_at, metadata', { count: 'exact' })
		.eq('project_id', project.id)
		.order('created_at', { ascending: false })
		.range(from, from + PAGE_SIZE - 1);

	const total = count ?? 0;
	return {
		entries: data ?? [],
		page,
		pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
		total
	};
};

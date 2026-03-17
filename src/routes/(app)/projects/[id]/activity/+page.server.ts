import type { PageServerLoad } from './$types';
import type { Tables } from '$lib/supabase/types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const { data } = await locals.supabase
		.from('activity_log')
		.select('*')
		.eq('project_id', params.id)
		.order('created_at', { ascending: false });

	return { activity: (data ?? []) as Tables<'activity_log'>[] };
};

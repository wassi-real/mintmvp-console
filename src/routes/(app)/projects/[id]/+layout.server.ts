import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import type { Tables } from '$lib/supabase/types';

export const load: LayoutServerLoad = async ({ locals, params }) => {
	const { supabase } = locals;

	const { data, error: fetchError } = await supabase
		.from('projects')
		.select('*')
		.eq('id', params.id)
		.single();

	const project = data as Tables<'projects'> | null;

	if (fetchError || !project) {
		throw error(404, 'Project not found');
	}

	return { project };
};

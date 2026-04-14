import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import type { Tables } from '$lib/supabase/types';
import { tryGithubAutoSyncFromLayout } from '$lib/server/github/run-sync';

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

	await tryGithubAutoSyncFromLayout(locals, params.id);

	return { project };
};

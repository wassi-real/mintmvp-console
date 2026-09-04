import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import type { Tables } from '$lib/supabase/types';
import { SIDEBAR_COOKIE, parseSidebarCollapsed } from '$lib/sidebar-state';

export const load: LayoutServerLoad = async ({ locals, params, cookies }) => {
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

	// GitHub sync deliberately does NOT run here — it would block every project navigation on a
	// GitHub round trip. The layout kicks it off against ./github/sync once the page has painted.
	return {
		project,
		sidebarCollapsed: parseSidebarCollapsed(cookies.get(SIDEBAR_COOKIE))
	};
};

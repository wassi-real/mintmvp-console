import type { PageServerLoad, Actions } from './$types';
import type { Tables } from '$lib/supabase/types';
import { fail } from '@sveltejs/kit';
import { logActivity, getActorName } from '$lib/server/activity';

export const load: PageServerLoad = async ({ locals, params }) => {
	let { data: health } = await locals.supabase
		.from('project_health')
		.select('*')
		.eq('project_id', params.id)
		.maybeSingle();

	// Auto-create default row if missing
	if (!health) {
		const { data: row } = await (locals.supabase.from('project_health') as any)
			.insert({ project_id: params.id })
			.select()
			.single();
		health = row;
	}

	const { data: incidents } = await locals.supabase
		.from('incidents')
		.select('id, status')
		.eq('project_id', params.id);

	return {
		health: health as Tables<'project_health'> | null,
		openIncidents: (incidents ?? []).filter((i: any) => i.status === 'open').length,
		totalIncidents: (incidents ?? []).length
	};
};

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		const form = await request.formData();
		const id = form.get('id') as string;
		const uptime_status = (form.get('uptime_status') as string) || 'unknown';
		const error_count = parseInt(form.get('error_count') as string) || 0;
		const warning_count = parseInt(form.get('warning_count') as string) || 0;

		if (!id) return fail(400, { error: 'ID is required' });

		const { error } = await (locals.supabase.from('project_health') as any)
			.update({
				uptime_status,
				error_count,
				warning_count,
				last_check_at: new Date().toISOString()
			})
			.eq('id', id);

		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, `Health status updated: ${uptime_status}`, getActorName(locals.session!));
		return { success: true };
	}
};

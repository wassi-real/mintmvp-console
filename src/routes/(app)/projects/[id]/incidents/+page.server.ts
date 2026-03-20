import type { PageServerLoad, Actions } from './$types';
import type { Tables } from '$lib/supabase/types';
import { fail } from '@sveltejs/kit';
import { logActivity, getActorName } from '$lib/server/activity';

export const load: PageServerLoad = async ({ locals, params }) => {
	const { data } = await locals.supabase
		.from('incidents')
		.select('*')
		.eq('project_id', params.id)
		.order('created_at', { ascending: false });

	return { incidents: (data ?? []) as Tables<'incidents'>[] };
};

export const actions: Actions = {
	create: async ({ request, locals, params }) => {
		const form = await request.formData();
		const title = (form.get('title') as string)?.trim();
		const severity = (form.get('severity') as string) || 'medium';
		const status = (form.get('status') as string) || 'open';
		const description = (form.get('description') as string)?.trim() || null;

		if (!title) return fail(400, { error: 'Title is required' });

		const { error } = await (locals.supabase.from('incidents') as any).insert({
			project_id: params.id,
			title,
			severity,
			status,
			description
		});

		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, `Bug reported: ${title}`, getActorName(locals.session!), { incident: title, severity });
		return { success: true };
	},

	update: async ({ request, locals, params }) => {
		const form = await request.formData();
		const id = form.get('id') as string;
		const title = (form.get('title') as string)?.trim();
		const severity = (form.get('severity') as string) || 'medium';
		const status = (form.get('status') as string) || 'open';
		const description = (form.get('description') as string)?.trim() || null;
		const wasResolved = form.get('wasResolved') === 'true';

		if (!id || !title) return fail(400, { error: 'ID and title are required' });

		const resolved_at = status === 'resolved' && !wasResolved ? new Date().toISOString() : (status !== 'resolved' ? null : undefined);
		const updatePayload: Record<string, any> = { title, severity, status, description };
		if (resolved_at !== undefined) updatePayload.resolved_at = resolved_at;

		const { error } = await (locals.supabase.from('incidents') as any)
			.update(updatePayload)
			.eq('id', id);

		if (error) return fail(500, { error: error.message });

		const action = status === 'resolved' && !wasResolved ? `Incident resolved: ${title}` : `Incident updated: ${title}`;
		await logActivity(locals.supabase, params.id, action, getActorName(locals.session!), { incident: title, status });
		return { success: true };
	},

	delete: async ({ request, locals, params }) => {
		const form = await request.formData();
		const id = form.get('id') as string;
		const title = form.get('title') as string;

		if (!id) return fail(400, { error: 'ID is required' });

		const { error } = await (locals.supabase.from('incidents') as any).delete().eq('id', id);

		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, `Incident deleted: ${title}`, getActorName(locals.session!), { incident: title });
		return { success: true };
	}
};

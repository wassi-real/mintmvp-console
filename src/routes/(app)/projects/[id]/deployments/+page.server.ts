import type { PageServerLoad, Actions } from './$types';
import type { Tables } from '$lib/supabase/types';
import { fail } from '@sveltejs/kit';
import { logActivity, getActorName } from '$lib/server/activity';

export const load: PageServerLoad = async ({ locals, params }) => {
	const { data } = await locals.supabase
		.from('deployments')
		.select('*')
		.eq('project_id', params.id)
		.order('created_at', { ascending: false });

	return { deployments: (data ?? []) as Tables<'deployments'>[] };
};

export const actions: Actions = {
	create: async ({ request, locals, params }) => {
		const form = await request.formData();
		const version = (form.get('version') as string)?.trim();
		const environment = (form.get('environment') as string) || 'staging';
		const status = (form.get('status') as string) || 'pending';
		const notes = (form.get('notes') as string)?.trim() || null;

		if (!version) return fail(400, { error: 'Version is required' });

		const { error } = await (locals.supabase.from('deployments') as any).insert({
			project_id: params.id,
			version,
			environment,
			status,
			notes
		});

		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, `Deployment ${version} pushed to ${environment}`, getActorName(locals.session!), { version, environment, status });
		return { success: true };
	},

	update: async ({ request, locals, params }) => {
		const form = await request.formData();
		const id = form.get('id') as string;
		const version = (form.get('version') as string)?.trim();
		const environment = (form.get('environment') as string) || 'staging';
		const status = (form.get('status') as string) || 'pending';
		const notes = (form.get('notes') as string)?.trim() || null;

		if (!id || !version) return fail(400, { error: 'ID and version are required' });

		const { error } = await (locals.supabase.from('deployments') as any)
			.update({ version, environment, status, notes })
			.eq('id', id);

		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, `Deployment ${version} updated`, getActorName(locals.session!), { version, environment, status });
		return { success: true };
	},

	delete: async ({ request, locals, params }) => {
		const form = await request.formData();
		const id = form.get('id') as string;
		const version = form.get('version') as string;

		if (!id) return fail(400, { error: 'ID is required' });

		const { error } = await (locals.supabase.from('deployments') as any).delete().eq('id', id);

		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, `Deployment ${version} deleted`, getActorName(locals.session!), { version });
		return { success: true };
	}
};

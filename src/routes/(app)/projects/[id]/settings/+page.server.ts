import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { logActivity, getActorName } from '$lib/server/activity';

export const load: PageServerLoad = async ({ locals, params }) => {
	// Project is already loaded by the layout — just pass it through
	return {};
};

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		const form = await request.formData();
		const name = (form.get('name') as string)?.trim();
		const repo_url = (form.get('repo_url') as string)?.trim() || null;
		const staging_url = (form.get('staging_url') as string)?.trim() || null;
		const production_url = (form.get('production_url') as string)?.trim() || null;
		const status = (form.get('status') as string) || 'active';

		if (!name) return fail(400, { action: 'update', error: 'Project name is required' });

		const { error } = await (locals.supabase.from('projects') as any)
			.update({ name, repo_url, staging_url, production_url, status })
			.eq('id', params.id);

		if (error) return fail(500, { action: 'update', error: error.message });

		await logActivity(
			locals.supabase,
			params.id,
			'Project settings updated',
			getActorName(locals.session!),
			{ name }
		);

		return { success: true, action: 'update' };
	},

	delete: async ({ request, locals, params }) => {
		const form = await request.formData();
		const confirm = (form.get('confirm') as string)?.trim();
		const projectName = (form.get('project_name') as string)?.trim();

		if (confirm !== projectName) {
			return fail(400, { action: 'delete', error: `Type the project name exactly to confirm` });
		}

		const { error } = await (locals.supabase.from('projects') as any)
			.delete()
			.eq('id', params.id);

		if (error) return fail(500, { action: 'delete', error: error.message });

		redirect(303, '/projects');
	}
};

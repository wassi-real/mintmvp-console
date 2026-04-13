import type { PageServerLoad, Actions } from './$types';
import type { Tables } from '$lib/supabase/types';
import { fail } from '@sveltejs/kit';
import { logActivity, getActorName } from '$lib/server/activity';

const ENV_KINDS = ['development', 'staging', 'production'] as const;

export const load: PageServerLoad = async ({ locals, params }) => {
	const { data: existing } = await locals.supabase
		.from('project_environments')
		.select('*')
		.eq('project_id', params.id)
		.order('kind');

	const envs = (existing ?? []) as Tables<'project_environments'>[];

	// Ensure all 3 kinds exist (upsert missing ones)
	for (const kind of ENV_KINDS) {
		if (!envs.find((e) => e.kind === kind)) {
			const { data: row } = await (locals.supabase.from('project_environments') as any)
				.insert({ project_id: params.id, kind })
				.select()
				.single();
			if (row) envs.push(row as Tables<'project_environments'>);
		}
	}

	envs.sort((a, b) => ENV_KINDS.indexOf(a.kind as any) - ENV_KINDS.indexOf(b.kind as any));

	return { environments: envs };
};

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		const form = await request.formData();
		const id = form.get('id') as string;
		const url = (form.get('url') as string)?.trim() || '';
		const current_version = (form.get('current_version') as string)?.trim() || '';
		const status = (form.get('status') as string) || 'unknown';

		if (!id) return fail(400, { error: 'ID is required' });

		const { error } = await (locals.supabase.from('project_environments') as any)
			.update({ url, current_version, status, last_deploy_at: current_version ? new Date().toISOString() : null })
			.eq('id', id);

		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, `Environment updated`, getActorName(locals.session!), { status });
		return { success: true };
	}
};

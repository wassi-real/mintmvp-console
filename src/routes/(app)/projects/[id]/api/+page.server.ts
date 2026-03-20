import type { PageServerLoad, Actions } from './$types';
import type { Tables } from '$lib/supabase/types';
import { fail } from '@sveltejs/kit';
import { generateApiKey, hashApiKey } from '$lib/server/api-keys';
import { getActorName } from '$lib/server/activity';

export const load: PageServerLoad = async ({ locals, params }) => {
	const { data } = await locals.supabase
		.from('api_keys')
		.select('id, project_id, name, key_prefix, created_by, created_at, last_used_at')
		.eq('project_id', params.id)
		.order('created_at', { ascending: false });

	return { apiKeys: (data ?? []) as Omit<Tables<'api_keys'>, 'key_hash'>[] };
};

export const actions: Actions = {
	create: async ({ request, locals, params }) => {
		const form = await request.formData();
		const name = (form.get('name') as string)?.trim();

		if (!name) return fail(400, { error: 'Name is required' });

		const rawKey = generateApiKey();
		const keyHash = hashApiKey(rawKey);
		const keyPrefix = rawKey.slice(0, 12) + '...';
		const actor = getActorName(locals.session!);

		const { error } = await (locals.supabase.from('api_keys') as any).insert({
			project_id: params.id,
			name,
			key_hash: keyHash,
			key_prefix: keyPrefix,
			created_by: actor
		});

		if (error) return fail(500, { error: error.message });

		return { success: true, rawKey };
	},

	delete: async ({ request, locals }) => {
		const form = await request.formData();
		const id = form.get('id') as string;

		if (!id) return fail(400, { error: 'ID is required' });

		const { error } = await (locals.supabase.from('api_keys') as any).delete().eq('id', id);

		if (error) return fail(500, { error: error.message });
		return { success: true };
	}
};

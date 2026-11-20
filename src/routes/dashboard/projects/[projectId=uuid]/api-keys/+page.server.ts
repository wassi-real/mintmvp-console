import { error, fail } from '@sveltejs/kit';
import { createHash, randomBytes } from 'node:crypto';
import { logActivity } from '#lib/server/activity.ts';
import { displayName, projectContext } from '#lib/server/context.ts';
import { VIEW_ONLY } from '#lib/server/crud.ts';
import { isUuid, text } from '#lib/server/validate.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const context = await projectContext(event);
	if (!context.canEdit) error(403, 'API keys are only visible to owners and developers.');

	const { data } = await context.supabase
		.from('api_keys')
		.select('id, name, key_prefix, created_by, created_at, last_used_at')
		.eq('project_id', context.project.id)
		.order('created_at', { ascending: false });

	return { keys: data ?? [] };
};

export const actions: Actions = {
	create: async (event) => {
		const context = await projectContext(event);
		if (!context.canEdit) return fail(403, { message: VIEW_ONLY });

		const name = text(await event.request.formData(), 'name');
		if (name.length < 2 || name.length > 80) {
			return fail(400, {
				message: 'Please fix the highlighted fields.',
				errors: { name: 'Give the key a name (2 to 80 characters).' }
			});
		}

		// The full key is shown once and never stored. Only a prefix and a hash are kept.
		const full = `mint_${randomBytes(24).toString('base64url')}`;
		const { error: failure } = await context.supabase.from('api_keys').insert({
			project_id: context.project.id,
			name,
			key_prefix: full.slice(0, 15),
			key_hash: createHash('sha256').update(full).digest('hex'),
			created_by: displayName(context.profile)
		});
		if (failure) {
			console.error('api key create failed:', failure.message);
			return fail(400, { message: 'Could not create the key. Please try again.' });
		}

		await logActivity(context, `API key created: ${name}`);
		return { message: 'API key created. Copy it now — it will not be shown again.', key: full };
	},

	delete: async (event) => {
		const context = await projectContext(event);
		if (!context.canEdit) return fail(403, { message: VIEW_ONLY });

		const id = text(await event.request.formData(), 'id');
		if (!isUuid(id)) return fail(400, { message: 'That key could not be found.' });

		const { data, error: failure } = await context.supabase
			.from('api_keys')
			.delete()
			.eq('id', id)
			.eq('project_id', context.project.id)
			.select('name')
			.maybeSingle();
		if (failure || !data) return fail(400, { message: 'That key could not be found.' });

		await logActivity(context, `API key revoked: ${data.name}`);
		return { message: 'API key revoked. Anything using it will stop working.' };
	}
};

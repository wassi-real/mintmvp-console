import { redirect } from '@sveltejs/kit';
import { isUuid, text } from '#lib/server/validate.ts';
import type { RequestHandler } from './$types';

/** Makes another workspace the active one. The database checks that the person is a member. */
export const POST: RequestHandler = async ({ request, locals }) => {
	const id = text(await request.formData(), 'organization_id');
	if (isUuid(id)) {
		const { error } = await locals.supabase.rpc('switch_workspace', { p_organization_id: id });
		if (error) console.error('switch_workspace failed:', error.message);
	}
	redirect(303, '/dashboard');
};

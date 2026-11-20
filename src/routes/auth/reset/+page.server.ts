import { fail, redirect } from '@sveltejs/kit';
import { PASSWORD_MIN } from '#lib/constants.ts';
import { authMessage } from '#lib/server/auth.ts';
import type { Actions, PageServerLoad } from './$types';

// The server hook only lets signed-in visitors reach this page. Someone arriving from a reset
// email is signed in by /auth/confirm first.
export const load: PageServerLoad = ({ locals }) => {
	return { email: locals.user?.email ?? '' };
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const form = await request.formData();
		const password = String(form.get('password') ?? '');
		const confirm = String(form.get('confirm') ?? '');

		if (password.length < PASSWORD_MIN || password.length > 72) {
			return fail(400, { message: `Use between ${PASSWORD_MIN} and 72 characters.` });
		}
		if (password !== confirm) {
			return fail(400, { message: 'The two passwords do not match. Type them again.' });
		}

		const { error } = await locals.supabase.auth.updateUser({ password });
		if (error) return fail(400, { message: authMessage(error) });

		redirect(303, '/dashboard');
	}
};

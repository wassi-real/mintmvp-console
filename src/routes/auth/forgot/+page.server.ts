import { fail } from '@sveltejs/kit';
import { authMessage } from '#lib/server/auth.ts';
import { isEmail, text } from '#lib/server/validate.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	return { expired: url.searchParams.get('notice') === 'expired' };
};

export const actions: Actions = {
	default: async ({ request, locals, url }) => {
		const email = text(await request.formData(), 'email').toLowerCase();
		if (!isEmail(email)) {
			return fail(400, { email, sent: false, message: 'Enter the email address you signed up with.' });
		}

		const { error } = await locals.supabase.auth.resetPasswordForEmail(email, {
			redirectTo: `${url.origin}/auth/confirm?next=/auth/reset`
		});

		// Only rate limiting is reported. Anything else gets the same answer, so this page cannot
		// be used to find out which email addresses have accounts.
		if (error && (error.status === 429 || error.code?.startsWith('over_'))) {
			return fail(429, { email, sent: false, message: authMessage(error) });
		}
		if (error) console.error('password reset request failed:', error.code, error.message);

		return { email, sent: true, message: '' };
	}
};

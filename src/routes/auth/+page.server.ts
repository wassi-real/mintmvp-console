import { fail, redirect } from '@sveltejs/kit';
import { PASSWORD_MIN } from '#lib/constants.ts';
import { authMessage, setPendingEmail } from '#lib/server/auth.ts';
import { safeNext } from '#lib/server/redirects.ts';
import { isEmail, text } from '#lib/server/validate.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const notices: Record<string, string> = {
		verified: 'Your email is confirmed. Log in to continue.',
		reset: 'Your password was changed. Log in with your new password.',
		signedout: 'You have been logged out.',
		expired: 'That link has expired or was already used. Log in, or ask for a new link.'
	};

	return {
		mode: url.searchParams.get('mode') === 'signup' ? ('signup' as const) : ('login' as const),
		next: safeNext(url.searchParams.get('next'), ''),
		notice: notices[url.searchParams.get('notice') ?? ''] ?? ''
	};
};

export const actions: Actions = {
	login: async (event) => {
		const form = await event.request.formData();
		const email = text(form, 'email').toLowerCase();
		const password = String(form.get('password') ?? '');
		const next = safeNext(text(form, 'next'), '/dashboard');

		const errors: Record<string, string> = {};
		if (!isEmail(email)) errors.email = 'Enter your email address.';
		if (!password) errors.password = 'Enter your password.';
		if (Object.keys(errors).length) {
			return fail(400, { mode: 'login', email, errors, message: '' });
		}

		const { error } = await event.locals.supabase.auth.signInWithPassword({ email, password });

		if (error?.code === 'email_not_confirmed') {
			setPendingEmail(event, email);
			redirect(303, '/email-verify');
		}
		if (error) {
			return fail(400, { mode: 'login', email, errors, message: authMessage(error) });
		}

		redirect(303, next);
	},

	signup: async (event) => {
		const form = await event.request.formData();
		const fullName = text(form, 'full_name');
		const email = text(form, 'email').toLowerCase();
		const password = String(form.get('password') ?? '');

		const errors: Record<string, string> = {};
		if (fullName.length < 2 || fullName.length > 80) {
			errors.full_name = 'Enter your name (2 to 80 characters).';
		}
		if (!isEmail(email)) errors.email = 'Enter a valid email address.';
		if (password.length < PASSWORD_MIN) {
			errors.password = `Use at least ${PASSWORD_MIN} characters.`;
		} else if (password.length > 72) {
			errors.password = 'Use 72 characters or fewer.';
		}
		if (Object.keys(errors).length) {
			return fail(400, { mode: 'signup', email, fullName, errors, message: '' });
		}

		const { data, error } = await event.locals.supabase.auth.signUp({
			email,
			password,
			options: {
				data: { full_name: fullName },
				emailRedirectTo: `${event.url.origin}/auth/confirm?next=/onboarding`
			}
		});

		if (error) {
			return fail(400, { mode: 'signup', email, fullName, errors, message: authMessage(error) });
		}

		// Projects that do not require email confirmation sign the user in straight away.
		if (data.session) redirect(303, '/onboarding');

		setPendingEmail(event, email);
		redirect(303, '/email-verify');
	}
};

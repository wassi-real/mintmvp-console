import { fail, redirect } from '@sveltejs/kit';
import { authMessage, clearPendingEmail, getPendingEmail, setPendingEmail } from '#lib/server/auth.ts';
import { isEmail, text } from '#lib/server/validate.ts';
import type { Actions, PageServerLoad } from './$types';

// Signed-in visitors never see this page: the server hook sends them on to the dashboard.
export const load: PageServerLoad = (event) => {
	return {
		email: getPendingEmail(event),
		expired: event.url.searchParams.get('notice') === 'expired'
	};
};

export const actions: Actions = {
	/** Sends the confirmation email again. */
	resend: async (event) => {
		const form = await event.request.formData();
		const email = (text(form, 'email') || getPendingEmail(event)).toLowerCase();
		if (!isEmail(email)) {
			return fail(400, { action: 'resend', message: 'Enter the email address you signed up with.' });
		}

		const { error } = await event.locals.supabase.auth.resend({
			type: 'signup',
			email,
			options: { emailRedirectTo: `${event.url.origin}/auth/confirm?next=/onboarding` }
		});
		if (error) return fail(400, { action: 'resend', message: authMessage(error) });

		setPendingEmail(event, email);
		return { action: 'resend', message: '', resent: true };
	},

	/** Confirms the address with the 6-digit code from the email. */
	code: async (event) => {
		const form = await event.request.formData();
		const email = (text(form, 'email') || getPendingEmail(event)).toLowerCase();
		const token = text(form, 'token').replace(/\s+/g, '');

		if (!isEmail(email)) {
			return fail(400, { action: 'code', message: 'Enter the email address you signed up with.' });
		}
		if (!/^\d{6,8}$/.test(token)) {
			return fail(400, { action: 'code', message: 'Enter the code from the email. It is all numbers.' });
		}

		const { error } = await event.locals.supabase.auth.verifyOtp({ email, token, type: 'email' });
		if (error) return fail(400, { action: 'code', message: authMessage(error) });

		clearPendingEmail(event);
		redirect(303, '/onboarding');
	},

	/** Lets someone who mistyped their address start again. */
	change: async (event) => {
		clearPendingEmail(event);
		redirect(303, '/auth?mode=signup');
	}
};

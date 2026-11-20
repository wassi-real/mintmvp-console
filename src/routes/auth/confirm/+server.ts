import { redirect } from '@sveltejs/kit';
import type { EmailOtpType } from '@supabase/supabase-js';
import { clearPendingEmail } from '#lib/server/auth.ts';
import { safeNext } from '#lib/server/redirects.ts';
import type { RequestHandler } from './$types';

const OTP_TYPES: readonly EmailOtpType[] = ['signup', 'email', 'recovery', 'invite', 'magiclink', 'email_change'];

/**
 * Landing point for links in confirmation and password-reset emails. Handles both link styles:
 *   ?token_hash=…&type=…  (the templates in supabase/templates; works in any browser)
 *   ?code=…               (Supabase's default templates; only works in the browser that signed up)
 */
export const GET: RequestHandler = async (event) => {
	const { url, locals } = event;
	const requested = url.searchParams.get('next');
	const recovery = requested === '/auth/reset';
	const next = recovery ? '/auth/reset' : safeNext(requested, '/onboarding');

	const tokenHash = url.searchParams.get('token_hash');
	const type = url.searchParams.get('type') as EmailOtpType | null;
	const code = url.searchParams.get('code');

	if (tokenHash && type && OTP_TYPES.includes(type)) {
		const { error } = await locals.supabase.auth.verifyOtp({ token_hash: tokenHash, type });
		if (!error) {
			clearPendingEmail(event);
			redirect(303, next);
		}
		redirect(303, recovery ? '/auth/forgot?notice=expired' : '/email-verify?notice=expired');
	}

	if (code) {
		const { error } = await locals.supabase.auth.exchangeCodeForSession(code);
		if (!error) {
			clearPendingEmail(event);
			redirect(303, next);
		}
		// The email itself was confirmed when the link was opened. The exchange only fails when the
		// link is opened in a different browser from the one that signed up, so ask them to log in.
		redirect(303, recovery ? '/auth/forgot?notice=expired' : '/auth?mode=login&notice=verified');
	}

	// Supabase reports an expired or already-used link with ?error=… in the query string.
	redirect(303, recovery ? '/auth/forgot?notice=expired' : '/email-verify?notice=expired');
};

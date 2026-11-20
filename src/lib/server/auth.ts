import type { RequestEvent } from '@sveltejs/kit';
import { dev } from '$app/env';

const PENDING_EMAIL_COOKIE = 'pending_email';

/** Remembers which address a confirmation email was sent to, so /email-verify can show it. */
export function setPendingEmail(event: RequestEvent, email: string) {
	event.cookies.set(PENDING_EMAIL_COOKIE, email, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: 60 * 60 * 24
	});
}

export function getPendingEmail(event: RequestEvent): string {
	return event.cookies.get(PENDING_EMAIL_COOKIE) ?? '';
}

export function clearPendingEmail(event: RequestEvent) {
	event.cookies.delete(PENDING_EMAIL_COOKIE, { path: '/' });
}

interface AuthFailure {
	code?: string;
	status?: number;
	message: string;
}

/** Turns a Supabase Auth error into a sentence a non-technical person can act on. */
export function authMessage(error: AuthFailure): string {
	switch (error.code) {
		case 'invalid_credentials':
			return 'That email and password do not match. Check them and try again.';
		case 'email_not_confirmed':
			return 'Please confirm your email address first. We sent you a link.';
		case 'user_already_exists':
		case 'email_exists':
			return 'An account with this email already exists. Try logging in instead.';
		case 'weak_password':
			return 'That password is too easy to guess. Use at least 8 characters with a mix of letters and numbers.';
		case 'same_password':
			return 'Your new password must be different from the old one.';
		case 'over_email_send_rate_limit':
		case 'over_request_rate_limit':
			return 'Too many attempts. Please wait a minute and try again.';
		case 'signup_disabled':
			return 'New sign-ups are turned off right now.';
		case 'email_address_invalid':
		case 'validation_failed':
			return 'That email address does not look right. Check it and try again.';
		case 'otp_expired':
			return 'That code or link has expired or was already used. Ask for a new one below.';
		case 'user_banned':
			return 'This account has been disabled. Contact support if you think this is a mistake.';
	}
	if (error.status === 429) return 'Too many attempts. Please wait a minute and try again.';
	console.error('auth error:', error.code, error.message);
	return 'We could not complete that. Please try again in a moment.';
}

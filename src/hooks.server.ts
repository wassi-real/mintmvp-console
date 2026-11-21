import { redirect } from '@sveltejs/kit';
import { sequence, type Handle } from '@sveltejs/kit/hooks';
import { createRequestClient, getServiceClient, hasAuthCookie } from '#lib/server/supabase.ts';
import { withOrigin } from '#lib/server/origin.ts';
import { safeNext } from '#lib/server/redirects.ts';

const supabase: Handle = async ({ event, resolve }) => {
	const client = createRequestClient(event);
	event.locals.supabase = client;
	event.locals.user = null;
	event.locals.profile = null;
	event.locals.theme = event.cookies.get('theme') === 'light' ? 'light' : 'dark';

	let lookup: Promise<{ id: string; email: string } | null> | undefined;
	event.locals.getUser = () => {
		lookup ??= (async () => {
			// No auth cookie means no session: skip the round trip to Supabase Auth.
			if (!hasAuthCookie(event)) return null;
			const { data, error } = await client.auth.getClaims();
			const claims = data?.claims;
			if (error || !claims?.sub) return null;
			return { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : '' };
		})();
		return lookup;
	};

	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%mint.theme%', event.locals.theme),
		filterSerializedResponseHeaders: (name) =>
			name === 'content-range' || name === 'x-supabase-api-version'
	});
};

const guard: Handle = async ({ event, resolve }) => {
	const path = event.url.pathname;
	const inDashboard = path === '/dashboard' || path.startsWith('/dashboard/');
	const inOnboarding = path === '/onboarding';
	const requiresUser = inDashboard || inOnboarding || path === '/auth/reset';
	const signedOutOnly = path === '/auth' || path === '/auth/forgot' || path === '/email-verify';

	if (requiresUser || signedOutOnly || path === '/') {
		event.locals.user = await event.locals.getUser();
	}
	const user = event.locals.user;

	if (requiresUser && !user) {
		const next = safeNext(path + event.url.search, '');
		redirect(303, next ? `/auth?next=${encodeURIComponent(next)}` : '/auth');
	}

	if (signedOutOnly && user) {
		redirect(303, safeNext(event.url.searchParams.get('next'), '/dashboard'));
	}

	if (user && (inDashboard || inOnboarding)) {
		let { data: profile } = await event.locals.supabase
			.from('users')
			.select('*')
			.eq('id', user.id)
			.maybeSingle();

		if (!profile) {
			// The signup trigger normally creates this row. Repair it if it is missing.
			const { data: created } = await getServiceClient()
				.from('users')
				.upsert(
					{ id: user.id, email: user.email, full_name: user.email.split('@')[0], role: 'owner' },
					{ onConflict: 'id', ignoreDuplicates: true }
				)
				.select('*')
				.maybeSingle();
			profile = created;
			if (!profile) {
				({ data: profile } = await event.locals.supabase
					.from('users')
					.select('*')
					.eq('id', user.id)
					.maybeSingle());
			}
		}

		event.locals.profile = profile;
		const ready = Boolean(profile?.onboarded_at && profile.organization_id);

		if (inDashboard && !ready) redirect(303, '/onboarding');
		if (inOnboarding && ready) redirect(303, '/dashboard');
	}

	const response = await withOrigin(event.url.origin, () => resolve(event));
	response.headers.set('x-frame-options', 'DENY');
	response.headers.set('x-content-type-options', 'nosniff');
	response.headers.set('referrer-policy', 'strict-origin-when-cross-origin');
	return response;
};

export const handle = sequence(supabase, guard);

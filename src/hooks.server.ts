import { createServiceClient } from '$lib/supabase/server';
import { redirect, type Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const supabase = createServiceClient(event.cookies);
	event.locals.supabase = supabase;

	const {
		data: { user },
		error: userError
	} = await supabase.auth.getUser();
	const {
		data: { session }
	} = await supabase.auth.getSession();

	// Only trust client-held session after server validates the user (avoids spoofed cookie payloads).
	event.locals.session = userError || !user ? null : session ?? null;

	// API routes handle their own auth via bearer token
	if (event.url.pathname.startsWith('/api/v1/')) {
		return resolve(event, {
			filterSerializedResponseHeaders(name) {
				return name === 'content-range' || name === 'x-supabase-api-version';
			}
		});
	}

	const isAuthRoute = event.url.pathname.startsWith('/login');
	const isRootRoute = event.url.pathname === '/';
	const isPublicMonitoringStatus =
		event.url.pathname.startsWith('/status/') && event.url.pathname.length > '/status/'.length;
	const isCronApi = event.url.pathname.startsWith('/api/cron/');

	if (isRootRoute) {
		throw redirect(303, event.locals.session ? '/dashboard' : '/login');
	}

	if (!event.locals.session && !isAuthRoute && !isPublicMonitoringStatus && !isCronApi) {
		throw redirect(303, '/login');
	}

	if (event.locals.session && isAuthRoute) {
		throw redirect(303, '/dashboard');
	}

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};

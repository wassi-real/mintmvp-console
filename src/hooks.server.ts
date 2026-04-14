import { createServiceClient } from '$lib/supabase/server';
import { redirect, type Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	const supabase = createServiceClient(event.cookies);
	event.locals.supabase = supabase;

	const {
		data: { session }
	} = await supabase.auth.getSession();
	event.locals.session = session;

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

	if (isRootRoute) {
		throw redirect(303, session ? '/dashboard' : '/login');
	}

	if (!session && !isAuthRoute && !isPublicMonitoringStatus) {
		throw redirect(303, '/login');
	}

	if (session && isAuthRoute) {
		throw redirect(303, '/dashboard');
	}

	return resolve(event, {
		filterSerializedResponseHeaders(name) {
			return name === 'content-range' || name === 'x-supabase-api-version';
		}
	});
};

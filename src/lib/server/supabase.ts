import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { RequestEvent } from '@sveltejs/kit';
import { PUBLIC_SUPABASE_ANON_KEY, PUBLIC_SUPABASE_URL } from '$app/env/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$app/env/private';
import type { Database } from '#lib/database.types.ts';

/**
 * Per-request client that acts as the signed-in user. Row level security applies to everything
 * it does, so it is the client used for all normal reads and writes.
 */
export function createRequestClient(event: RequestEvent): SupabaseClient<Database> {
	return createServerClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => event.cookies.getAll(),
			setAll: (cookies) => {
				for (const { name, value, options } of cookies) {
					event.cookies.set(name, value, { ...options, path: '/' });
				}
			}
		}
	});
}

let serviceClient: SupabaseClient<Database> | undefined;

/**
 * Bypasses row level security. Only for code paths that have no signed-in user (public API keys,
 * public status pages) or that repair a missing profile row. Never import this from UI code.
 */
export function getServiceClient(): SupabaseClient<Database> {
	serviceClient ??= createClient<Database>(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
	});
	return serviceClient;
}

export function hasAuthCookie(event: RequestEvent): boolean {
	return event.cookies
		.getAll()
		.some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token'));
}

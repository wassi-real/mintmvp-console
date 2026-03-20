import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { env } from '$env/dynamic/private';
import type { Database } from './types';
import type { Cookies } from '@sveltejs/kit';

/** User-scoped client (browser session via cookies). Used for the dashboard. */
export function createServiceClient(cookies: Cookies) {
	return createServerClient<Database>(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY, {
		cookies: {
			getAll: () => cookies.getAll(),
			setAll: (cookiesToSet) => {
				cookiesToSet.forEach(({ name, value, options }) => {
					cookies.set(name, value, { ...options, path: '/' });
				});
			}
		}
	});
}

/**
 * Service role client — bypasses RLS. Use only on the server for `/api/v1/*`
 * after validating an API key; always scope queries to the validated project_id.
 */
export function createServiceRoleClient() {
	const secret = env.SUPABASE_SERVICE_ROLE_KEY;
	if (!secret) {
		throw new Error(
			'SUPABASE_SERVICE_ROLE_KEY is missing. Add it to .env for REST API access (Supabase Dashboard → Settings → API → service_role).'
		);
	}
	return createClient<Database>(PUBLIC_SUPABASE_URL, secret, {
		auth: { persistSession: false, autoRefreshToken: false }
	});
}

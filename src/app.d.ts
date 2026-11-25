import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Row } from '#lib/database.types.ts';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient<Database>;
			/** The signed-in user, verified against Supabase Auth. Memoised per request. */
			getUser: () => Promise<{ id: string; email: string } | null>;
			/** Set by the server hook on every route that requires a signed-in user. */
			user: { id: string; email: string } | null;
			/** Set by the server hook on /dashboard and /onboarding. */
			profile: Row<'users'> | null;
			theme: 'dark' | 'light';
			/** Rate limit headers for public API responses, set when an API key is checked. */
			apiHeaders?: Record<string, string>;
		}
		// interface Error {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};

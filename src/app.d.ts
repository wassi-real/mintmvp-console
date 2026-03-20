import type { SupabaseClient, Session } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/types';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient<Database>;
			session: Session | null;
		}
		interface PageData {
			session: Session | null;
		}
	}
}

export {};

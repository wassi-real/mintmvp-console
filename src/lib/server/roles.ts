import type { SupabaseClient } from '@supabase/supabase-js';

export async function isProjectStaff(supabase: SupabaseClient, userId: string): Promise<boolean> {
	const { data } = await supabase.from('users').select('role').eq('id', userId).maybeSingle();
	return data?.role === 'owner' || data?.role === 'developer';
}

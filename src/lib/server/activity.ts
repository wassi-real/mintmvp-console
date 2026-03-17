import type { SupabaseClient } from '@supabase/supabase-js';

export async function logActivity(
	supabase: SupabaseClient,
	projectId: string,
	action: string,
	actor: string,
	metadata?: Record<string, unknown>
) {
	await (supabase.from('activity_log') as any).insert({
		project_id: projectId,
		action,
		actor,
		metadata: metadata ?? null
	});
}

export function getActorName(session: { user: { email?: string; user_metadata?: { full_name?: string } } }): string {
	return session.user.user_metadata?.full_name ?? session.user.email?.split('@')[0] ?? 'Unknown';
}

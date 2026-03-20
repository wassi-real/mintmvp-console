import { createHash, randomBytes } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

const KEY_PREFIX = 'mint_';

export function generateApiKey(): string {
	return KEY_PREFIX + randomBytes(20).toString('hex');
}

export function hashApiKey(key: string): string {
	return createHash('sha256').update(key).digest('hex');
}

export async function validateApiKey(
	supabase: SupabaseClient,
	rawKey: string
): Promise<{ projectId: string } | null> {
	if (!rawKey.startsWith(KEY_PREFIX)) return null;

	const hash = hashApiKey(rawKey);

	const { data, error } = await (supabase.from('api_keys') as any)
		.select('id, project_id')
		.eq('key_hash', hash)
		.single();

	if (error || !data) return null;

	// fire-and-forget last_used_at update
	(supabase.from('api_keys') as any)
		.update({ last_used_at: new Date().toISOString() })
		.eq('id', data.id)
		.then(() => {});

	return { projectId: data.project_id };
}

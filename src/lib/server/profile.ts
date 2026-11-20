import type { SupabaseClient } from '@supabase/supabase-js';
import { AVATAR_MAX_BYTES, AVATAR_TYPES, USERNAME_PATTERN } from '#lib/constants.ts';
import type { Database } from '#lib/database.types.ts';

const EXTENSIONS: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
	'image/gif': 'gif'
};

const RESERVED = new Set([
	'admin',
	'administrator',
	'api',
	'auth',
	'dashboard',
	'help',
	'mintmvp',
	'onboarding',
	'root',
	'settings',
	'support',
	'system'
]);

export function normalizeUsername(value: string): string {
	return value.trim().toLowerCase().replace(/^@/, '');
}

/** Returns a problem description, or an empty string when the format is acceptable. */
export function usernameProblem(username: string): string {
	if (username.length < 3) return 'Use at least 3 characters.';
	if (username.length > 24) return 'Use 24 characters or fewer.';
	if (!USERNAME_PATTERN.test(username)) {
		return 'Use only lowercase letters, numbers and underscores.';
	}
	if (RESERVED.has(username)) return 'That username is reserved. Choose another one.';
	return '';
}

/** Returns a problem description, or an empty string when the file is acceptable. */
export function avatarProblem(file: File): string {
	if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) {
		return 'Choose a PNG, JPG, WebP or GIF image.';
	}
	if (file.size > AVATAR_MAX_BYTES) return 'Choose an image smaller than 2 MB.';
	return '';
}

/**
 * Uploads a profile picture into the user's own folder of the public "avatars" bucket and
 * returns its public address. Storage policies only allow writes inside that folder.
 */
export async function uploadAvatar(
	supabase: SupabaseClient<Database>,
	userId: string,
	file: File
): Promise<{ url: string } | { error: string }> {
	const problem = avatarProblem(file);
	if (problem) return { error: problem };

	const path = `${userId}/${Date.now()}.${EXTENSIONS[file.type]}`;
	const { error } = await supabase.storage
		.from('avatars')
		.upload(path, file, { contentType: file.type, cacheControl: '31536000' });

	if (error) {
		console.error('avatar upload failed:', error.message);
		return { error: 'We could not upload that picture. Please try a different image.' };
	}
	return { url: supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl };
}

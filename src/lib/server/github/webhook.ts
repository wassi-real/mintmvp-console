import { getGitHubAppEnv } from './env';

/**
 * Verify GitHub webhook signature (HMAC SHA-256).
 */
export async function verifyWebhookSignature(
	rawBody: string,
	signature: string | null
): Promise<boolean> {
	if (!signature || !signature.startsWith('sha256=')) return false;

	const { webhookSecret } = getGitHubAppEnv();
	const enc = new TextEncoder();
	const key = await crypto.subtle.importKey(
		'raw',
		enc.encode(webhookSecret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const sig = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
	const computed = 'sha256=' + Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
	return timingSafeEqual(computed, signature);
}

function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let result = 0;
	for (let i = 0; i < a.length; i++) {
		result |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return result === 0;
}

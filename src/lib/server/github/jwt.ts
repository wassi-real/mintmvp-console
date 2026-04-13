import { getGitHubAppEnv } from './env';

/**
 * Creates a JWT for authenticating as the GitHub App.
 * Uses the Web Crypto API (available in Node 18+ / Edge runtimes).
 */
export async function createAppJwt(): Promise<string> {
	const { appId, privateKey } = getGitHubAppEnv();

	const now = Math.floor(Date.now() / 1000);
	const header = { alg: 'RS256', typ: 'JWT' };
	const payload = { iat: now - 60, exp: now + 600, iss: appId };

	const enc = new TextEncoder();
	const headerB64 = base64url(enc.encode(JSON.stringify(header)));
	const payloadB64 = base64url(enc.encode(JSON.stringify(payload)));
	const signingInput = `${headerB64}.${payloadB64}`;

	const key = await importPKCS8(privateKey);
	const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(signingInput));

	return `${signingInput}.${base64url(new Uint8Array(sig))}`;
}

async function importPKCS8(pem: string): Promise<CryptoKey> {
	const lines = pem
		.replace(/-----BEGIN RSA PRIVATE KEY-----/, '')
		.replace(/-----END RSA PRIVATE KEY-----/, '')
		.replace(/-----BEGIN PRIVATE KEY-----/, '')
		.replace(/-----END PRIVATE KEY-----/, '')
		.replace(/\s/g, '');

	const binary = Uint8Array.from(atob(lines), (c) => c.charCodeAt(0));

	return crypto.subtle.importKey(
		'pkcs8',
		binary,
		{ name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
		false,
		['sign']
	);
}

function base64url(bytes: Uint8Array): string {
	let s = '';
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

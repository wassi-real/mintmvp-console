import { createPrivateKey, createSign } from 'node:crypto';
import { getGitHubAppEnv } from './env';

/**
 * Creates a JWT for authenticating as the GitHub App (RS256).
 * Uses Node `crypto.createPrivateKey`, which accepts both PKCS#1 (`BEGIN RSA PRIVATE KEY`)
 * and PKCS#8 (`BEGIN PRIVATE KEY`) PEM — GitHub’s default download is PKCS#1, which Web
 * Crypto’s `importKey('pkcs8')` cannot load (that caused "Invalid keyData").
 */
export function createAppJwt(): string {
	const { appId, privateKey } = getGitHubAppEnv();
	const pem = privateKey.trim();
	if (!pem.includes('BEGIN')) {
		throw new Error(
			'GITHUB_APP_PRIVATE_KEY does not look like PEM (missing BEGIN line). Check .env formatting.'
		);
	}

	const now = Math.floor(Date.now() / 1000);
	const header = { alg: 'RS256', typ: 'JWT' };
	const payload = { iat: now - 60, exp: now + 600, iss: String(appId) };

	const encHeader = base64urlJson(header);
	const encPayload = base64urlJson(payload);
	const signingInput = `${encHeader}.${encPayload}`;

	const key = createPrivateKey({ key: pem, format: 'pem' });
	const sign = createSign('RSA-SHA256');
	sign.update(signingInput, 'utf8');
	const signature = sign.sign(key);

	return `${signingInput}.${base64urlBuffer(signature)}`;
}

function base64urlJson(obj: object): string {
	return base64urlBuffer(Buffer.from(JSON.stringify(obj), 'utf8'));
}

function base64urlBuffer(buf: Buffer): string {
	return buf
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

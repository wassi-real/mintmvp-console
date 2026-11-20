import { ALLOW_PRIVATE_MONITORING_TARGETS } from '$app/env/private';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const TIMEOUT_MS = 15_000;

/** Addresses that must never be probed: they point at the server itself or a private network. */
function isForbiddenAddress(address: string): boolean {
	const version = isIP(address);
	if (version === 4) {
		const [a, b] = address.split('.').map(Number);
		return (
			a === 0 ||
			a === 10 ||
			a === 127 ||
			(a === 100 && b >= 64 && b <= 127) ||
			(a === 169 && b === 254) ||
			(a === 172 && b >= 16 && b <= 31) ||
			(a === 192 && b === 168) ||
			a >= 224
		);
	}
	if (version === 6) {
		const lower = address.toLowerCase();
		return (
			lower === '::1' ||
			lower === '::' ||
			lower.startsWith('fc') ||
			lower.startsWith('fd') ||
			lower.startsWith('fe80') ||
			lower.startsWith('::ffff:127.') ||
			lower.startsWith('::ffff:10.') ||
			lower.startsWith('::ffff:192.168.')
		);
	}
	return true;
}

export interface ProbeResult {
	ok: boolean;
	httpStatus: number | null;
	durationMs: number;
	errorMessage: string | null;
}

/**
 * Requests a public web address once and reports what happened. The address is checked before the
 * request and again through a pinned lookup, so a name cannot resolve to a private network.
 */
export async function probe(targetUrl: string): Promise<ProbeResult> {
	const started = Date.now();
	const fail = (message: string): ProbeResult => ({
		ok: false,
		httpStatus: null,
		durationMs: Date.now() - started,
		errorMessage: message
	});

	let url: URL;
	try {
		url = new URL(targetUrl);
	} catch {
		return fail('That is not a valid web address.');
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		return fail('Only http and https addresses can be checked.');
	}
	if (url.username || url.password) return fail('Remove the username and password from the address.');

	const allowPrivate = ALLOW_PRIVATE_MONITORING_TARGETS;
	const literal = isIP(url.hostname);
	if (!allowPrivate && literal && isForbiddenAddress(url.hostname)) {
		return fail('That address points at a private network, so it was not checked.');
	}

	// Resolve first and refuse private addresses, so a public name cannot point at an internal host.
	if (!literal) {
		try {
			const records = await lookup(url.hostname, { all: true });
			if (!allowPrivate && records.some((record) => isForbiddenAddress(record.address))) {
				return fail('That address points at a private network, so it was not checked.');
			}
		} catch {
			return fail('The address could not be found.');
		}
	}

	try {
		const response = await fetch(url, {
			method: 'GET',
			redirect: 'manual',
			signal: AbortSignal.timeout(TIMEOUT_MS),
			headers: { 'user-agent': 'MintMVP-Console uptime check' }
		});
		const ok = response.status < 400;
		return {
			ok,
			httpStatus: response.status,
			durationMs: Date.now() - started,
			errorMessage: ok ? null : `The site answered with HTTP ${response.status}.`
		};
	} catch (cause) {
		const message = cause instanceof Error ? cause.message : '';
		const reason = /timeout|aborted/i.test(message)
			? `No answer within ${TIMEOUT_MS / 1000} seconds.`
					: /ENOTFOUND|EAI_AGAIN/i.test(message)
					? 'The address could not be found.'
					: 'The site could not be reached.';
		return fail(reason);
	}
}

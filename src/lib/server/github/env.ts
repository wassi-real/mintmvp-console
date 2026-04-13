import { env } from '$env/dynamic/private';

export interface GitHubAppEnv {
	appId: string;
	privateKey: string;
	webhookSecret: string;
	clientId: string;
	clientSecret: string;
}

let _cached: GitHubAppEnv | null = null;

export function getGitHubAppEnv(): GitHubAppEnv {
	if (_cached) return _cached;

	const appId = env.GITHUB_APP_ID ?? '';
	const privateKey = (env.GITHUB_APP_PRIVATE_KEY ?? '')
		.replace(/\\n/g, '\n')
		.trim();
	const webhookSecret = env.GITHUB_WEBHOOK_SECRET ?? '';
	const clientId = env.GITHUB_APP_CLIENT_ID ?? '';
	const clientSecret = env.GITHUB_APP_CLIENT_SECRET ?? '';

	if (!appId || !privateKey || !webhookSecret) {
		throw new Error(
			'Missing GitHub App env vars. Set GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_WEBHOOK_SECRET in .env'
		);
	}

	_cached = { appId, privateKey, webhookSecret, clientId, clientSecret };
	return _cached;
}

export function hasGitHubAppEnv(): boolean {
	try {
		getGitHubAppEnv();
		return true;
	} catch {
		return false;
	}
}

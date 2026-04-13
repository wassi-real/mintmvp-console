import { createAppJwt } from './jwt';

const GH_API = 'https://api.github.com';

/**
 * Exchange an installation ID for a short-lived access token.
 */
export async function getInstallationToken(
	installationId: number
): Promise<{ token: string; expires_at: string }> {
	const jwt = createAppJwt();
	const res = await ghFetch(`/app/installations/${installationId}/access_tokens`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${jwt}` }
	});
	return res as { token: string; expires_at: string };
}

/**
 * List repositories accessible to the installation.
 */
export async function listInstallationRepos(
	token: string
): Promise<{ id: number; full_name: string; name: string; owner: { login: string } }[]> {
	const res = (await ghFetch('/installation/repositories', {
		headers: { Authorization: `token ${token}` }
	})) as { repositories: any[] };
	return res.repositories ?? [];
}

/**
 * Fetch branches for a repo.
 */
export async function fetchBranches(
	token: string,
	owner: string,
	repo: string
): Promise<{ name: string; commit: { sha: string; message?: string } }[]> {
	const branches = (await ghFetch(`/repos/${owner}/${repo}/branches?per_page=100`, {
		headers: { Authorization: `token ${token}` }
	})) as any[];
	return branches.map((b) => ({
		name: b.name,
		commit: { sha: b.commit.sha, message: b.commit.commit?.message ?? '' }
	}));
}

/**
 * Fetch pull requests for a repo.
 */
export async function fetchPullRequests(
	token: string,
	owner: string,
	repo: string,
	state: 'open' | 'closed' | 'all' = 'all'
): Promise<any[]> {
	return (await ghFetch(`/repos/${owner}/${repo}/pulls?state=${state}&per_page=100&sort=updated`, {
		headers: { Authorization: `token ${token}` }
	})) as any[];
}

/**
 * Fetch recent commits for a repo (default branch).
 */
export async function fetchCommits(
	token: string,
	owner: string,
	repo: string,
	perPage = 50
): Promise<any[]> {
	return (await ghFetch(`/repos/${owner}/${repo}/commits?per_page=${perPage}`, {
		headers: { Authorization: `token ${token}` }
	})) as any[];
}

/**
 * Fetch workflow runs (CI).
 */
export async function fetchWorkflowRuns(
	token: string,
	owner: string,
	repo: string,
	perPage = 30
): Promise<any[]> {
	const res = (await ghFetch(`/repos/${owner}/${repo}/actions/runs?per_page=${perPage}`, {
		headers: { Authorization: `token ${token}` }
	})) as { workflow_runs: any[] };
	return res.workflow_runs ?? [];
}

/**
 * Fetch deployments for a repo.
 */
export async function fetchDeployments(
	token: string,
	owner: string,
	repo: string,
	perPage = 30
): Promise<any[]> {
	return (await ghFetch(`/repos/${owner}/${repo}/deployments?per_page=${perPage}`, {
		headers: { Authorization: `token ${token}` }
	})) as any[];
}

/**
 * Fetch deployment statuses for a specific deployment.
 */
export async function fetchDeploymentStatuses(
	token: string,
	owner: string,
	repo: string,
	deploymentId: number
): Promise<any[]> {
	return (await ghFetch(
		`/repos/${owner}/${repo}/deployments/${deploymentId}/statuses?per_page=10`,
		{ headers: { Authorization: `token ${token}` } }
	)) as any[];
}

async function ghFetch(path: string, init: RequestInit): Promise<unknown> {
	const url = path.startsWith('http') ? path : `${GH_API}${path}`;
	const res = await fetch(url, {
		...init,
		headers: {
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			...init.headers
		}
	});
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(`GitHub API ${res.status}: ${text}`);
	}
	return res.json();
}

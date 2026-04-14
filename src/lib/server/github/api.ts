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
	return fetchAllBranches(token, owner, repo, 1);
}

/** Paginated branch list (GitHub caps 100 per page). */
export async function fetchAllBranches(
	token: string,
	owner: string,
	repo: string,
	maxPages = 50
): Promise<{ name: string; commit: { sha: string; message?: string } }[]> {
	const o = encodeURIComponent(owner);
	const r = encodeURIComponent(repo);
	const out: { name: string; commit: { sha: string; message?: string } }[] = [];
	for (let page = 1; page <= maxPages; page++) {
		const branches = (await ghFetch(`/repos/${o}/${r}/branches?per_page=100&page=${page}`, {
			headers: { Authorization: `token ${token}` }
		})) as any[];
		if (!branches.length) break;
		for (const b of branches) {
			out.push({
				name: b.name,
				commit: { sha: b.commit.sha, message: b.commit?.commit?.message ?? '' }
			});
		}
		if (branches.length < 100) break;
	}
	return out;
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
	return fetchAllPullRequests(token, owner, repo, state, 1);
}

export async function fetchAllPullRequests(
	token: string,
	owner: string,
	repo: string,
	state: 'open' | 'closed' | 'all' = 'all',
	maxPages = 30
): Promise<any[]> {
	const o = encodeURIComponent(owner);
	const r = encodeURIComponent(repo);
	const all: any[] = [];
	for (let page = 1; page <= maxPages; page++) {
		const chunk = (await ghFetch(
			`/repos/${o}/${r}/pulls?state=${state}&per_page=100&sort=updated&page=${page}`,
			{ headers: { Authorization: `token ${token}` } }
		)) as any[];
		if (!chunk.length) break;
		all.push(...chunk);
		if (chunk.length < 100) break;
	}
	return all;
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
	const o = encodeURIComponent(owner);
	const r = encodeURIComponent(repo);
	return (await ghFetch(`/repos/${o}/${r}/commits?per_page=${perPage}`, {
		headers: { Authorization: `token ${token}` }
	})) as any[];
}

/** Recent commits on the default branch, newest first (paginated). */
export async function fetchAllCommits(
	token: string,
	owner: string,
	repo: string,
	maxPages = 30
): Promise<any[]> {
	const o = encodeURIComponent(owner);
	const r = encodeURIComponent(repo);
	const all: any[] = [];
	for (let page = 1; page <= maxPages; page++) {
		const chunk = (await ghFetch(`/repos/${o}/${r}/commits?per_page=100&page=${page}`, {
			headers: { Authorization: `token ${token}` }
		})) as any[];
		if (!chunk.length) break;
		all.push(...chunk);
		if (chunk.length < 100) break;
	}
	return all;
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
	const o = encodeURIComponent(owner);
	const r = encodeURIComponent(repo);
	const res = (await ghFetch(`/repos/${o}/${r}/actions/runs?per_page=${perPage}`, {
		headers: { Authorization: `token ${token}` }
	})) as { workflow_runs: any[] };
	return res.workflow_runs ?? [];
}

export async function fetchAllWorkflowRuns(
	token: string,
	owner: string,
	repo: string,
	maxPages = 10
): Promise<any[]> {
	const o = encodeURIComponent(owner);
	const r = encodeURIComponent(repo);
	const all: any[] = [];
	for (let page = 1; page <= maxPages; page++) {
		const res = (await ghFetch(`/repos/${o}/${r}/actions/runs?per_page=100&page=${page}`, {
			headers: { Authorization: `token ${token}` }
		})) as { workflow_runs: any[] };
		const chunk = res.workflow_runs ?? [];
		if (!chunk.length) break;
		all.push(...chunk);
		if (chunk.length < 100) break;
	}
	return all;
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
	const o = encodeURIComponent(owner);
	const r = encodeURIComponent(repo);
	return (await ghFetch(`/repos/${o}/${r}/deployments?per_page=${perPage}`, {
		headers: { Authorization: `token ${token}` }
	})) as any[];
}

export async function fetchAllDeployments(
	token: string,
	owner: string,
	repo: string,
	maxPages = 10
): Promise<any[]> {
	const o = encodeURIComponent(owner);
	const r = encodeURIComponent(repo);
	const all: any[] = [];
	for (let page = 1; page <= maxPages; page++) {
		const chunk = (await ghFetch(`/repos/${o}/${r}/deployments?per_page=100&page=${page}`, {
			headers: { Authorization: `token ${token}` }
		})) as any[];
		if (!chunk.length) break;
		all.push(...chunk);
		if (chunk.length < 100) break;
	}
	return all;
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
	const o = encodeURIComponent(owner);
	const r = encodeURIComponent(repo);
	return (await ghFetch(
		`/repos/${o}/${r}/deployments/${deploymentId}/statuses?per_page=10`,
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

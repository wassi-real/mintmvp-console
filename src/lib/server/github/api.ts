import { createAppJwt } from './jwt';

const GH_API = 'https://api.github.com';

/** Installation access tokens should use Bearer (GitHub docs; token scheme is for classic PATs). */
export function installationAuthHeaders(token: string): { Authorization: string } {
	return { Authorization: `Bearer ${token}` };
}

export type InstallationTokenOptions = {
	/** Narrow token to these full names (`owner/repo`). Strongly recommended for repo API calls. */
	repositories?: string[];
};

function isRepoScopeToken422(message: string): boolean {
	const m = message.toLowerCase();
	return (
		m.includes('422') &&
		(m.includes('does not exist or is not accessible') ||
			m.includes('not accessible to the parent installation'))
	);
}

/**
 * Exchange an installation ID for a short-lived access token.
 * Optionally pass `repositories: ['owner/repo']` to narrow the token; if GitHub returns 422
 * (repo string not on this installation or casing mismatch), falls back to an unscoped token.
 */
export async function getInstallationToken(
	installationId: number,
	opts?: InstallationTokenOptions
): Promise<{ token: string; expires_at: string }> {
	const jwt = createAppJwt();
	const repos = opts?.repositories?.map((s) => s.trim()).filter(Boolean) ?? [];

	const postAccessToken = (body: string | undefined) =>
		ghFetch(`/app/installations/${installationId}/access_tokens`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${jwt}`,
				...(body ? { 'Content-Type': 'application/json' } : {})
			},
			body
		}) as Promise<{ token: string; expires_at: string }>;

	if (repos.length > 0) {
		try {
			return await postAccessToken(JSON.stringify({ repositories: repos }));
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			if (isRepoScopeToken422(msg)) {
				return await postAccessToken(undefined);
			}
			throw e;
		}
	}

	return await postAccessToken(undefined);
}

/**
 * Installation ID for **this** GitHub App on the given repository (JWT as the app).
 * Use to fix a stored `installation_id` that points at another account’s install of the same app.
 */
export async function fetchRepositoryInstallationId(
	owner: string,
	repo: string
): Promise<number | null> {
	const jwt = createAppJwt();
	const o = encodeURIComponent(owner.trim());
	const r = encodeURIComponent(repo.trim());
	try {
		const data = (await ghFetch(`/repos/${o}/${r}/installation`, {
			headers: { Authorization: `Bearer ${jwt}` }
		})) as { id?: number };
		return typeof data?.id === 'number' ? data.id : null;
	} catch (e) {
		const m = e instanceof Error ? e.message : String(e);
		if (/\b404\b/.test(m)) return null;
		throw e;
	}
}

function mapInstallationRepo(r: {
	id: number;
	full_name: string;
	name: string;
	owner: { login: string };
}): { id: number; full_name: string; name: string; owner: { login: string } } {
	return {
		id: r.id,
		full_name: r.full_name,
		name: r.name,
		owner: { login: r.owner?.login ?? '' }
	};
}

/**
 * List repositories accessible to the installation (all pages; GitHub paginates at 100).
 */
export async function listInstallationRepos(
	token: string
): Promise<{ id: number; full_name: string; name: string; owner: { login: string } }[]> {
	const headers = installationAuthHeaders(token);
	const out: { id: number; full_name: string; name: string; owner: { login: string } }[] = [];
	for (let page = 1; page <= 50; page++) {
		const res = (await ghFetch(`/installation/repositories?per_page=100&page=${page}`, {
			headers
		})) as { repositories: any[] };
		const chunk = res.repositories ?? [];
		for (const r of chunk) {
			out.push(mapInstallationRepo(r));
		}
		if (chunk.length < 100) break;
	}
	return out;
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
			headers: installationAuthHeaders(token)
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
			{ headers: installationAuthHeaders(token) }
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
		headers: installationAuthHeaders(token)
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
			headers: installationAuthHeaders(token)
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
		headers: installationAuthHeaders(token)
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
			headers: installationAuthHeaders(token)
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
		headers: installationAuthHeaders(token)
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
			headers: installationAuthHeaders(token)
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
		{ headers: installationAuthHeaders(token) }
	)) as any[];
}

function formatGithubApiErrorBody(status: number, text: string): string {
	let parsed: string | undefined;
	try {
		const j = JSON.parse(text) as { message?: string };
		if (typeof j?.message === 'string' && j.message.trim()) parsed = j.message.trim();
	} catch {
		/* ignore */
	}
	if (parsed) return `GitHub API ${status}: ${parsed}`;
	const t = text.trim();
	if (t) return `GitHub API ${status}: ${t.slice(0, 500)}${t.length > 500 ? '…' : ''}`;
	return `GitHub API ${status}`;
}

async function ghFetch(path: string, init: RequestInit): Promise<unknown> {
	const url = path.startsWith('http') ? path : `${GH_API}${path}`;
	const res = await fetch(url, {
		...init,
		headers: {
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28',
			'User-Agent': 'MintMVP-Console/1.0 (GitHub App)',
			...init.headers
		}
	});
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(formatGithubApiErrorBody(res.status, text));
	}
	return res.json();
}

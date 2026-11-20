import { APP_ENCRYPTION_KEY } from '$app/env/private';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { dbMessage } from './crud.ts';
import type { ProjectContext } from './context.ts';

const SALT = 'mintmvp-console-github-token';

function secret(): Buffer | null {
	const value = APP_ENCRYPTION_KEY;
	return value ? scryptSync(value, SALT, 32) : null;
}

/** Stores a token so it is unreadable in the database when an encryption key is configured. */
export function sealToken(token: string): string {
	const key = secret();
	if (!key) return token;
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', key, iv);
	const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
	return `enc:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function openToken(stored: string): string | null {
	if (!stored.startsWith('enc:')) return stored;
	const key = secret();
	if (!key) return null;
	const [, iv, tag, data] = stored.split(':');
	try {
		const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
		decipher.setAuthTag(Buffer.from(tag, 'base64url'));
		return Buffer.concat([
			decipher.update(Buffer.from(data, 'base64url')),
			decipher.final()
		]).toString('utf8');
	} catch {
		return null;
	}
}

export interface GithubConnection {
	owner: string;
	repo: string;
	token: string;
	lastSyncAt: string | null;
}

/** The project's saved GitHub connection, or a plain-English reason it cannot be used. */
export async function githubConnection(
	context: ProjectContext
): Promise<GithubConnection | { problem: string }> {
	const { data } = await context.supabase
		.from('project_integrations_github')
		.select('repo_owner, repo_name, access_token, last_sync_at')
		.eq('project_id', context.project.id)
		.maybeSingle();

	if (!data) return { problem: 'GitHub is not connected for this project.' };
	if (!data.access_token) {
		return { problem: 'A personal access token is needed before anything can be synced.' };
	}
	const token = openToken(data.access_token);
	if (!token) {
		return { problem: 'The saved token could not be read. Save it again on the Integrations page.' };
	}
	return { owner: data.repo_owner, repo: data.repo_name, token, lastSyncAt: data.last_sync_at };
}

interface GithubResponse {
	ok: boolean;
	status: number;
	json: unknown;
	nextPage: number | null;
}

async function github(
	connection: GithubConnection,
	path: string,
	page = 1
): Promise<GithubResponse> {
	const url = new URL(`https://api.github.com${path}`);
	url.searchParams.set('per_page', '100');
	url.searchParams.set('page', String(page));

	const response = await fetch(url, {
		headers: {
			accept: 'application/vnd.github+json',
			authorization: `Bearer ${connection.token}`,
			'user-agent': 'MintMVP-Console',
			'x-github-api-version': '2022-11-28'
		}
	});

	const next = /<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="next"/.exec(response.headers.get('link') ?? '');
	return {
		ok: response.ok,
		status: response.status,
		json: response.status === 204 ? null : await response.json().catch(() => null),
		nextPage: next ? Number(next[1]) : null
	};
}

/** Follows pagination, stopping at a hard cap so a huge repository cannot run forever. */
async function pages(connection: GithubConnection, path: string, cap: number): Promise<unknown[]> {
	const rows: unknown[] = [];
	for (let page = 1; rows.length < cap; page += 1) {
		const response = await github(connection, path, page);
		if (!response.ok || !Array.isArray(response.json)) break;
		rows.push(...response.json);
		if (!response.nextPage || response.json.length === 0) break;
	}
	return rows.slice(0, cap);
}

function text(value: unknown, fallback = ''): string {
	return typeof value === 'string' ? value : fallback;
}
function number(value: unknown): number {
	return typeof value === 'number' ? value : 0;
}

export interface SyncResult {
	ok: true;
	summary: string;
}

/**
 * Pulls the repository's branches, commits, pull requests, workflow runs and deployments into the
 * existing GitHub tables. Existing rows are updated in place, so nothing is duplicated.
 */
export async function syncGithub(
	context: ProjectContext,
	connection: GithubConnection
): Promise<SyncResult | { error: string }> {
	const repo = `/repos/${connection.owner}/${connection.repo}`;
	const probe = await github(connection, repo);
	if (!probe.ok) {
		const reason =
			probe.status === 401 || probe.status === 403
				? 'GitHub refused the token. Check that it is valid and can read this repository.'
				: probe.status === 404
					? 'GitHub could not find that repository. Check the owner and name.'
					: `GitHub answered with an error (HTTP ${probe.status}). Try again in a moment.`;
		return { error: reason };
	}

	const [branchRows, commitRows, pullRows, runRows, deployRows] = await Promise.all([
		pages(connection, `${repo}/branches`, 200),
		pages(connection, `${repo}/commits`, 300),
		pages(connection, `${repo}/pulls?state=all`, 200),
		pages(connection, `${repo}/actions/runs`, 200),
		pages(connection, `${repo}/deployments`, 200)
	]);

	const supabase = context.supabase;
	const projectId = context.project.id;
	const now = new Date().toISOString();

	const writes = await Promise.all([
		branchRows.length
			? supabase.from('github_branches').upsert(
					branchRows.map((row) => {
						const item = row as Record<string, unknown>;
						const commit = (item.commit ?? {}) as Record<string, unknown>;
						return {
							project_id: projectId,
							name: text(item.name),
							last_commit_sha: text(commit.sha),
							last_commit_message: '',
							status: 'active' as const,
							updated_at: now
						};
					}),
					{ onConflict: 'project_id,name' }
				)
			: Promise.resolve({ error: null }),

		commitRows.length
			? supabase.from('github_commits').upsert(
					commitRows.map((row) => {
						const item = row as Record<string, unknown>;
						const commit = (item.commit ?? {}) as Record<string, unknown>;
						const author = (commit.author ?? {}) as Record<string, unknown>;
						const person = (item.author ?? {}) as Record<string, unknown>;
						return {
							project_id: projectId,
							sha: text(item.sha),
							message: text(commit.message).slice(0, 2000),
							author: text(person.login) || text(author.name) || 'unknown',
							branch: '',
							committed_at: text(author.date, now)
						};
					}),
					{ onConflict: 'project_id,sha' }
				)
			: Promise.resolve({ error: null }),

		pullRows.length
			? supabase.from('github_pull_requests').upsert(
					pullRows.map((row) => {
						const item = row as Record<string, unknown>;
						const head = (item.head ?? {}) as Record<string, unknown>;
						const user = (item.user ?? {}) as Record<string, unknown>;
						return {
							project_id: projectId,
							gh_number: number(item.number),
							title: text(item.title).slice(0, 500),
							author: text(user.login, 'unknown'),
							branch: text(head.ref),
							status: item.merged_at ? 'merged' : text(item.state, 'open'),
							created_at: text(item.created_at, now),
							merged_at: text(item.merged_at) || null
						};
					}),
					{ onConflict: 'project_id,gh_number' }
				)
			: Promise.resolve({ error: null }),

		runRows.length
			? supabase.from('github_ci_runs').upsert(
					runRows.map((row) => {
						const item = row as Record<string, unknown>;
						const conclusion = text(item.conclusion);
						const status = conclusion
							? conclusion === 'success'
								? 'success'
								: conclusion === 'cancelled' || conclusion === 'skipped'
									? 'cancelled'
									: 'failure'
							: text(item.status) === 'in_progress'
								? 'in_progress'
								: 'pending';
						return {
							project_id: projectId,
							gh_run_id: String(number(item.id)),
							workflow_name: text(item.name, 'Workflow'),
							branch: text(item.head_branch),
							commit_sha: text(item.head_sha),
							status,
							created_at: text(item.created_at, now)
						};
					}),
					{ onConflict: 'project_id,gh_run_id' }
				)
			: Promise.resolve({ error: null }),

		deployRows.length
			? supabase.from('github_deployments').upsert(
					deployRows.map((row) => {
						const item = row as Record<string, unknown>;
						return {
							project_id: projectId,
							gh_deploy_id: String(number(item.id)),
							environment: text(item.environment, 'unknown'),
							commit_sha: text(item.sha),
							ref: text(item.ref) || null,
							status: 'pending' as const,
							created_at: text(item.created_at, now)
						};
					}),
					{ onConflict: 'project_id,gh_deploy_id' }
				)
			: Promise.resolve({ error: null })
	]);

	const failed = writes.find((write) => write.error);
	if (failed?.error) return { error: dbMessage(failed.error, 'sync') };

	await supabase
		.from('project_integrations_github')
		.update({ last_sync_at: now })
		.eq('project_id', projectId);

	const summary = [
		`${branchRows.length} branches`,
		`${commitRows.length} commits`,
		`${pullRows.length} pull requests`,
		`${runRows.length} workflow runs`,
		`${deployRows.length} deployments`
	].join(', ');
	return { ok: true, summary };
}

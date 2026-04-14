import type { SupabaseClient } from '@supabase/supabase-js';
import {
	getInstallationToken,
	fetchAllBranches,
	fetchAllPullRequests,
	fetchAllCommits,
	fetchAllWorkflowRuns,
	fetchAllDeployments,
	fetchDeploymentStatuses
} from './api';

/**
 * Ensure the stored access token for this integration is still valid.
 * If expired, fetch a new one and persist it.
 */
export async function ensureToken(
	supabase: SupabaseClient,
	integration: { id: string; installation_id: number; access_token: string; token_expires_at: string | null }
): Promise<string> {
	if (
		integration.access_token &&
		integration.token_expires_at &&
		new Date(integration.token_expires_at) > new Date(Date.now() + 60_000)
	) {
		return integration.access_token;
	}

	const { token, expires_at } = await getInstallationToken(integration.installation_id);
	const { error } = await (supabase.from('project_integrations_github') as any)
		.update({ access_token: token, token_expires_at: expires_at })
		.eq('id', integration.id);
	if (error) throw new Error(`Could not persist GitHub token: ${error.message}`);

	return token;
}

async function upsertRows(
	supabase: SupabaseClient,
	table: string,
	rows: Record<string, unknown>[],
	onConflict: string
): Promise<void> {
	if (!rows.length) return;
	const { error } = await (supabase.from(table) as any).upsert(rows, { onConflict });
	if (error) throw new Error(`${table}: ${error.message}`);
}

/**
 * Full backfill: pull branches, PRs, commits, CI runs, and deployments
 * from GitHub and upsert into our sync tables.
 */
export async function fullSync(
	supabase: SupabaseClient,
	projectId: string,
	token: string,
	owner: string,
	repo: string
): Promise<{ branches: number; prs: number; commits: number; ciRuns: number; deployments: number }> {
	const counts = { branches: 0, prs: 0, commits: 0, ciRuns: 0, deployments: 0 };

	const [bRes, prRes, cRes, rRes, dRes] = await Promise.allSettled([
		fetchAllBranches(token, owner, repo),
		fetchAllPullRequests(token, owner, repo, 'all'),
		fetchAllCommits(token, owner, repo),
		fetchAllWorkflowRuns(token, owner, repo),
		fetchAllDeployments(token, owner, repo)
	]);

	const warn: string[] = [];
	if (bRes.status === 'rejected') {
		const msg = bRes.reason instanceof Error ? bRes.reason.message : String(bRes.reason);
		throw new Error(`GitHub branches: ${msg}`);
	}
	if (cRes.status === 'rejected') {
		const msg = cRes.reason instanceof Error ? cRes.reason.message : String(cRes.reason);
		throw new Error(`GitHub commits: ${msg}`);
	}
	if (prRes.status === 'rejected') warn.push(`pulls: ${prRes.reason}`);
	if (rRes.status === 'rejected') warn.push(`workflow_runs: ${rRes.reason}`);
	if (dRes.status === 'rejected') warn.push(`deployments: ${dRes.reason}`);
	if (warn.length) console.warn('[github fullSync] non-fatal fetch failures', warn.join('; '));

	const ghBranches = bRes.value;
	const ghPRs = prRes.status === 'fulfilled' ? prRes.value : [];
	const ghCommits = cRes.value;
	const ghRuns = rRes.status === 'fulfilled' ? rRes.value : [];
	const ghDeploys = dRes.status === 'fulfilled' ? dRes.value : [];

	if (ghBranches.length) {
		const rows = ghBranches.map((b) => ({
			project_id: projectId,
			name: b.name,
			last_commit_sha: b.commit.sha,
			last_commit_message: (b.commit.message ?? '').slice(0, 2000),
			updated_at: new Date().toISOString(),
			status: 'active'
		}));
		await upsertRows(supabase, 'github_branches', rows, 'project_id,name');
		counts.branches = rows.length;
	}

	if (ghPRs.length) {
		const rows = ghPRs.map((pr: any) => ({
			project_id: projectId,
			gh_number: pr.number,
			title: pr.title,
			branch: pr.head?.ref ?? '',
			status: pr.merged_at ? 'merged' : pr.state === 'closed' ? 'closed' : 'open',
			author: pr.user?.login ?? '',
			created_at: pr.created_at,
			merged_at: pr.merged_at ?? null
		}));
		await upsertRows(supabase, 'github_pull_requests', rows, 'project_id,gh_number');
		counts.prs = rows.length;
	}

	if (ghCommits.length) {
		const rows = ghCommits.map((c: any) => ({
			project_id: projectId,
			sha: c.sha,
			branch: '',
			message: (c.commit?.message ?? '').slice(0, 500),
			author: c.commit?.author?.name ?? c.author?.login ?? '',
			committed_at: c.commit?.author?.date ?? new Date().toISOString()
		}));
		await upsertRows(supabase, 'github_commits', rows, 'project_id,sha');
		counts.commits = rows.length;
	}

	if (ghRuns.length) {
		const rows = ghRuns.map((r: any) => ({
			project_id: projectId,
			gh_run_id: r.id,
			workflow_name: r.name ?? '',
			branch: r.head_branch ?? '',
			commit_sha: r.head_sha ?? '',
			status: mapCIStatus(r.status, r.conclusion),
			created_at: r.created_at
		}));
		await upsertRows(supabase, 'github_ci_runs', rows, 'project_id,gh_run_id');
		counts.ciRuns = rows.length;
	}

	if (ghDeploys.length) {
		const deployRows = [];
		for (const d of ghDeploys) {
			let status = 'pending';
			try {
				const statuses = await fetchDeploymentStatuses(token, owner, repo, d.id);
				if (statuses.length) status = mapDeployStatus(statuses[0].state);
			} catch {
				/* keep pending */
			}
			deployRows.push({
				project_id: projectId,
				gh_deploy_id: d.id,
				environment: d.environment ?? 'production',
				commit_sha: d.sha ?? '',
				status,
				created_at: d.created_at
			});
		}
		if (deployRows.length) {
			await upsertRows(supabase, 'github_deployments', deployRows, 'project_id,gh_deploy_id');
			counts.deployments = deployRows.length;
		}
	}

	const { error: tsErr } = await (supabase.from('project_integrations_github') as any)
		.update({ last_sync_at: new Date().toISOString() })
		.eq('project_id', projectId);
	if (tsErr) console.warn('[github fullSync] last_sync_at update', tsErr);

	return counts;
}

function mapCIStatus(status: string | null, conclusion: string | null): string {
	const s = (status ?? '').toLowerCase();
	const c = (conclusion ?? '').toLowerCase();
	if (s === 'queued' || s === 'waiting' || s === 'pending' || s === 'requested') return 'pending';
	if (s === 'in_progress') return 'in_progress';
	if (s === 'completed') {
		if (c === 'success') return 'success';
		if (c === 'failure') return 'failure';
		if (c === 'cancelled') return 'cancelled';
		if (c === 'skipped' || c === 'neutral') return 'success';
		return 'pending';
	}
	return 'pending';
}

function mapDeployStatus(state: string): string {
	const m: Record<string, string> = {
		success: 'success',
		failure: 'failure',
		error: 'failure',
		inactive: 'inactive',
		pending: 'pending',
		in_progress: 'pending',
		queued: 'pending'
	};
	return m[state] ?? 'pending';
}

import type { SupabaseClient } from '@supabase/supabase-js';
import {
	getInstallationToken,
	fetchBranches,
	fetchPullRequests,
	fetchCommits,
	fetchWorkflowRuns,
	fetchDeployments,
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
	await (supabase.from('project_integrations_github') as any)
		.update({ access_token: token, token_expires_at: expires_at })
		.eq('id', integration.id);

	return token;
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

	const [ghBranches, ghPRs, ghCommits, ghRuns, ghDeploys] = await Promise.all([
		fetchBranches(token, owner, repo).catch(() => []),
		fetchPullRequests(token, owner, repo, 'all').catch(() => []),
		fetchCommits(token, owner, repo, 100).catch(() => []),
		fetchWorkflowRuns(token, owner, repo, 50).catch(() => []),
		fetchDeployments(token, owner, repo, 50).catch(() => [])
	]);

	if (ghBranches.length) {
		const rows = ghBranches.map((b) => ({
			project_id: projectId,
			name: b.name,
			last_commit_sha: b.commit.sha,
			last_commit_message: b.commit.message ?? '',
			updated_at: new Date().toISOString(),
			status: 'active'
		}));
		await (supabase.from('github_branches') as any).upsert(rows, { onConflict: 'project_id,name' });
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
		await (supabase.from('github_pull_requests') as any).upsert(rows, { onConflict: 'project_id,gh_number' });
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
		await (supabase.from('github_commits') as any).upsert(rows, { onConflict: 'project_id,sha' });
		counts.commits = rows.length;
	}

	if (ghRuns.length) {
		const rows = ghRuns.map((r: any) => ({
			project_id: projectId,
			gh_run_id: r.id,
			workflow_name: r.name ?? '',
			branch: r.head_branch ?? '',
			commit_sha: r.head_sha ?? '',
			status: mapCIStatus(r.conclusion ?? r.status),
			created_at: r.created_at
		}));
		await (supabase.from('github_ci_runs') as any).upsert(rows, { onConflict: 'project_id,gh_run_id' });
		counts.ciRuns = rows.length;
	}

	if (ghDeploys.length) {
		const deployRows = [];
		for (const d of ghDeploys) {
			let status = 'pending';
			try {
				const statuses = await fetchDeploymentStatuses(token, owner, repo, d.id);
				if (statuses.length) status = mapDeployStatus(statuses[0].state);
			} catch { /* keep pending */ }
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
			await (supabase.from('github_deployments') as any).upsert(deployRows, { onConflict: 'project_id,gh_deploy_id' });
			counts.deployments = deployRows.length;
		}
	}

	await (supabase.from('project_integrations_github') as any)
		.update({ last_sync_at: new Date().toISOString() })
		.eq('project_id', projectId);

	return counts;
}

function mapCIStatus(raw: string | null): string {
	if (!raw) return 'pending';
	const m: Record<string, string> = {
		success: 'success',
		failure: 'failure',
		cancelled: 'cancelled',
		in_progress: 'in_progress',
		queued: 'pending',
		completed: 'success'
	};
	return m[raw] ?? 'pending';
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

import type { Tables } from '$lib/supabase/types';
import { createServiceRoleClient } from '$lib/supabase/server';
import { fetchDeployments, fetchDeploymentStatuses } from './api';
import { ensureToken } from './sync';

export type GithubDeploymentLogRow = {
	source: 'live' | 'cached';
	gh_deploy_id: number;
	environment: string;
	ref: string | null;
	commit_sha: string;
	created_at: string;
	state: string;
	description: string | null;
	environment_url: string | null;
	log_url: string | null;
	target_url: string | null;
	creator_login: string | null;
};

export function deploymentLogRowsFromDbOnly(
	cachedFromDb: Tables<'github_deployments'>[]
): GithubDeploymentLogRow[] {
	return cachedFromDb.map(mapGithubDeploymentDbRow);
}

function mapGithubDeploymentDbRow(d: Tables<'github_deployments'>): GithubDeploymentLogRow {
	return {
		source: 'cached',
		gh_deploy_id: d.gh_deploy_id,
		environment: d.environment,
		ref: d.ref,
		commit_sha: d.commit_sha,
		created_at: d.created_at,
		state: d.status,
		description: null,
		environment_url: null,
		log_url: null,
		target_url: null,
		creator_login: null
	};
}

/**
 * Load recent GitHub deployments and latest status per deployment (REST API when possible, else DB cache).
 */
export async function loadGithubDeploymentLogForProject(
	projectId: string,
	cachedFromDb: Tables<'github_deployments'>[]
): Promise<{
	rows: GithubDeploymentLogRow[];
	source: 'live' | 'cached' | 'none';
	error: string | null;
}> {
	let admin: ReturnType<typeof createServiceRoleClient>;
	try {
		admin = createServiceRoleClient();
	} catch {
		if (!cachedFromDb.length) return { rows: [], source: 'none', error: null };
		return { rows: cachedFromDb.map(mapGithubDeploymentDbRow), source: 'cached', error: null };
	}

	const { data: integ } = await admin
		.from('project_integrations_github')
		.select('id, installation_id, access_token, token_expires_at, repo_owner, repo_name')
		.eq('project_id', projectId)
		.maybeSingle();

	const row = integ as {
		id: string;
		installation_id: number;
		access_token: string;
		token_expires_at: string | null;
		repo_owner: string | null;
		repo_name: string | null;
	} | null;

	if (!row?.installation_id || !(row.repo_owner ?? '').trim() || !(row.repo_name ?? '').trim()) {
		if (!cachedFromDb.length) return { rows: [], source: 'none', error: null };
		return { rows: cachedFromDb.map(mapGithubDeploymentDbRow), source: 'cached', error: null };
	}

	try {
		const token = await ensureToken(admin, row);
		const owner = row.repo_owner!.trim();
		const repo = row.repo_name!.trim();
		const list = await fetchDeployments(token, owner, repo, 30);
		const capped = (list as any[]).slice(0, 15);
		const rows: GithubDeploymentLogRow[] = await Promise.all(
			capped.map(async (d: any) => {
				let latest: Record<string, unknown> | null = null;
				try {
					const statuses = await fetchDeploymentStatuses(token, owner, repo, d.id);
					latest = (statuses[0] as Record<string, unknown>) ?? null;
				} catch {
					/* non-fatal */
				}
				const apiState =
					latest && typeof latest.state === 'string' ? String(latest.state) : 'pending';
				return {
					source: 'live' as const,
					gh_deploy_id: d.id as number,
					environment: String(d.environment ?? 'production'),
					ref: typeof d.ref === 'string' ? d.ref : null,
					commit_sha: typeof d.sha === 'string' ? d.sha : '',
					created_at: d.created_at as string,
					state: apiState,
					description: typeof latest?.description === 'string' ? latest.description : null,
					environment_url:
						typeof latest?.environment_url === 'string' ? latest.environment_url : null,
					log_url: typeof latest?.log_url === 'string' ? latest.log_url : null,
					target_url: typeof latest?.target_url === 'string' ? latest.target_url : null,
					creator_login:
						(d.creator?.login as string | undefined) ??
						((latest?.creator as { login?: string } | undefined)?.login ?? null)
				};
			})
		);
		return { rows, source: 'live', error: null };
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'GitHub deployments could not be loaded';
		if (cachedFromDb.length) {
			return {
				rows: cachedFromDb.map(mapGithubDeploymentDbRow),
				source: 'cached',
				error: msg
			};
		}
		return { rows: [], source: 'none', error: msg };
	}
}

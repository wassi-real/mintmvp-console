import { randomBytes } from 'node:crypto';
import { error } from '@sveltejs/kit';
import { createServiceRoleClient } from '$lib/supabase/server';
import type { Tables } from '$lib/supabase/types';
import {
	loadGithubDeploymentLogForProject,
	type GithubDeploymentLogRow
} from '$lib/server/github/deployment-log';

const TOKEN_RE = /^[a-f0-9]{64}$/;

export function newPublicMonitoringToken(): string {
	return randomBytes(32).toString('hex');
}

export type PublicMonitoringServiceRow = {
	name: string;
	lastOk: boolean | null;
	lastChecked: string | null;
	/** Fraction of successful checks in the last 24h, or null if no runs in window */
	uptime24h: number | null;
};

export type PublicGithubCiRun = {
	gh_run_id: number;
	workflow_name: string;
	branch: string;
	status: string;
	commit_sha: string;
	created_at: string;
};

export type PublicMonitoringPayload = {
	projectName: string;
	health: Tables<'project_health'> | null;
	openIncidents: number;
	totalIncidents: number;
	updatedAt: string | null;
	services: PublicMonitoringServiceRow[];
	/** Connected repo for outbound links only */
	githubRepo: { owner: string; repo: string } | null;
	githubDeploymentLog: GithubDeploymentLogRow[];
	githubDeploymentLogSource: 'live' | 'cached' | 'none';
	githubCiRuns: PublicGithubCiRun[];
};

/**
 * Load monitoring snapshot for a public status URL. Uses service role after token validation only.
 */
export async function loadPublicMonitoringByToken(rawToken: string): Promise<PublicMonitoringPayload> {
	const token = rawToken.trim().toLowerCase();
	if (!TOKEN_RE.test(token)) {
		throw error(404, 'Not found');
	}

	const admin = createServiceRoleClient();

	const { data: link, error: linkErr } = await (admin.from('project_monitoring_public') as any)
		.select('project_id, is_enabled')
		.eq('token', token)
		.maybeSingle();

	if (linkErr || !link || !link.is_enabled) {
		throw error(404, 'Not found');
	}

	const projectId = link.project_id as string;

	const [{ data: project, error: pErr }, { data: health }, { data: incidents }, { data: targets }] =
		await Promise.all([
			admin.from('projects').select('name').eq('id', projectId).maybeSingle(),
			admin.from('project_health').select('*').eq('project_id', projectId).maybeSingle(),
			admin.from('incidents').select('id, status').eq('project_id', projectId),
			admin.from('monitoring_targets').select('id, name').eq('project_id', projectId).eq('enabled', true)
		]);

	if (pErr || !project) {
		throw error(404, 'Not found');
	}

	const inc = (incidents ?? []) as { id: string; status: string }[];
	const targetRows = (targets ?? []) as { id: string; name: string }[];
	const ids = targetRows.map((t) => t.id);

	let services: PublicMonitoringServiceRow[] = [];
	if (ids.length) {
		const { data: runs } = await admin
			.from('monitoring_check_runs')
			.select('target_id, ok, checked_at')
			.in('target_id', ids)
			.order('checked_at', { ascending: false })
			.limit(400);

		const sinceMs = Date.now() - 24 * 60 * 60 * 1000;
		const lastMap = new Map<string, { ok: boolean; checked_at: string }>();
		const stats = new Map<string, { ok: number; total: number }>();
		for (const r of runs ?? []) {
			const row = r as { target_id: string; ok: boolean; checked_at: string };
			if (!lastMap.has(row.target_id)) {
				lastMap.set(row.target_id, { ok: row.ok, checked_at: row.checked_at });
			}
			if (new Date(row.checked_at).getTime() >= sinceMs) {
				const s = stats.get(row.target_id) ?? { ok: 0, total: 0 };
				s.total++;
				if (row.ok) s.ok++;
				stats.set(row.target_id, s);
			}
		}

		services = targetRows.map((t) => {
			const last = lastMap.get(t.id);
			const st = stats.get(t.id);
			return {
				name: t.name,
				lastOk: last ? last.ok : null,
				lastChecked: last?.checked_at ?? null,
				uptime24h: st && st.total > 0 ? st.ok / st.total : null
			};
		});
	}

	const [{ data: integGh }, { data: ghDeployRows }, { data: pubCiRuns }] = await Promise.all([
		admin.from('project_integrations_github').select('repo_owner, repo_name').eq('project_id', projectId).maybeSingle(),
		admin
			.from('github_deployments')
			.select('*')
			.eq('project_id', projectId)
			.order('created_at', { ascending: false })
			.limit(40),
		admin
			.from('github_ci_runs')
			.select('gh_run_id, workflow_name, branch, status, commit_sha, created_at')
			.eq('project_id', projectId)
			.order('created_at', { ascending: false })
			.limit(25)
	]);

	const ig = integGh as { repo_owner: string; repo_name: string } | null;
	const githubRepo =
		ig?.repo_owner?.trim() && ig?.repo_name?.trim()
			? { owner: ig.repo_owner.trim(), repo: ig.repo_name.trim() }
			: null;

	const cachedDeployRows = (ghDeployRows ?? []) as Tables<'github_deployments'>[];
	const githubLogPack = await loadGithubDeploymentLogForProject(projectId, cachedDeployRows);

	const githubCiRuns = (pubCiRuns ?? []) as PublicGithubCiRun[];

	return {
		projectName: (project as { name: string }).name,
		health: health as Tables<'project_health'> | null,
		openIncidents: inc.filter((i) => i.status === 'open').length,
		totalIncidents: inc.length,
		updatedAt: (health as Tables<'project_health'> | null)?.last_check_at ?? null,
		services,
		githubRepo,
		githubDeploymentLog: githubLogPack.rows,
		githubDeploymentLogSource: githubLogPack.source,
		githubCiRuns
	};
}

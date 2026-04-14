import type { SupabaseClient } from '@supabase/supabase-js';
import { GITHUB_SYNC_INTERVAL_MS } from '$lib/github-sync-constants';
import { createServiceRoleClient } from '$lib/supabase/server';
import { isProjectStaff } from '$lib/server/roles';
import { fetchRepositoryInstallationId } from './api';
import { ensureToken, fullSync } from './sync';

export { GITHUB_SYNC_INTERVAL_MS } from '$lib/github-sync-constants';

/**
 * True when GitHub rejected the installation for this repository (permissions, repo not on the
 * install, org SAML, etc.). Intentionally excludes generic 403s (e.g. rate limit) so we do not
 * mislabel unrelated failures.
 */
export function isGitHubIntegrationAccessError(message: string): boolean {
	const m = message.toLowerCase();
	if (m.includes('rate limit') || m.includes('abuse detection mechanism')) return false;
	if (m.includes('resource not accessible by integration')) return true;
	if (m.includes('not accessible by integration')) return true;
	if (m.includes('saml') && (m.includes('sso') || m.includes('enforcement'))) return true;
	if (m.includes('403') && m.includes('installation')) return true;
	return false;
}

/** User-facing text when sync fails with installation/repo access errors. */
export function formatGitHubPermissionHint(githubMessage?: string): string {
	const lines = [
		'GitHub refused API access for this installation.',
		'',
		'This app mints installation tokens scoped to your linked `owner/repo` and may correct a mismatched Installation ID when GitHub reports a different install for that repository.',
		'',
		'Checklist:',
		'• GitHub App → Repository permissions: Contents **Read-only** (required for branches/commits), Pull requests **Read** (for PRs), Actions **Read** (for workflow runs), Deployments **Read**.',
		'• https://github.com/settings/installations → your app → **Configure** → ensure **this repository** is allowed, then save.',
		'• After changing the app, open the installation again and **accept updated permissions** if GitHub prompts.',
		'• On orgs with SAML SSO: Organization → Settings → Third-party access → authorize this GitHub App.'
	];
	const base = lines.join('\n');
	const g = githubMessage?.trim();
	if (!g) return base;
	const short = g.length > 700 ? `${g.slice(0, 700)}…` : g;
	return `${base}\n\nGitHub: ${short}`;
}

/** Avoid hammering GitHub on every navigation after a 403 (single-node dev / warm server). */
const accessDeniedCooldownUntil = new Map<string, number>();
const ACCESS_DENIED_COOLDOWN_MS = 5 * 60 * 1000;

type LocalsLike = {
	supabase: SupabaseClient;
	session: { user: { id: string } } | null;
};

/**
 * Runs a full GitHub → DB sync using the **service role** client so writes succeed
 * regardless of RLS (dashboard sync must work for staff after GitHub API calls).
 * Call only after verifying the user is staff via `locals.supabase`.
 */
export async function githubSyncForProject(
	locals: LocalsLike,
	projectId: string,
	opts?: { force?: boolean }
): Promise<
	| { ok: true; skipped?: boolean; counts?: Awaited<ReturnType<typeof fullSync>> }
	| { ok: false; reason: string; message?: string }
> {
	if (!locals.session?.user?.id) return { ok: false, reason: 'no_session' };
	if (!(await isProjectStaff(locals.supabase, locals.session.user.id))) return { ok: false, reason: 'forbidden' };

	let admin: ReturnType<typeof createServiceRoleClient>;
	try {
		admin = createServiceRoleClient();
	} catch {
		return { ok: false, reason: 'no_service_role' };
	}

	const { data: integration } = await (admin.from('project_integrations_github') as any)
		.select('*')
		.eq('project_id', projectId)
		.maybeSingle();

	if (!integration) return { ok: false, reason: 'no_integration' };

	const until = accessDeniedCooldownUntil.get(projectId);
	if (!opts?.force && until != null && Date.now() < until) {
		return { ok: true, skipped: true };
	}

	const last = integration.last_sync_at ? new Date(integration.last_sync_at as string).getTime() : 0;
	if (!opts?.force && last > 0 && Date.now() - last < GITHUB_SYNC_INTERVAL_MS) {
		return { ok: true, skipped: true };
	}

	const owner = (integration.repo_owner as string).trim();
	const repo = (integration.repo_name as string).trim();

	const runSync = async (token: string) =>
		fullSync(admin, projectId, token, owner, repo);

	type Integ = Parameters<typeof ensureToken>[1];
	let integ = { ...integration } as Integ;

	for (let attempt = 0; attempt < 3; attempt++) {
		const token = await ensureToken(admin, integ);
		try {
			const counts = await runSync(token);
			accessDeniedCooldownUntil.delete(projectId);
			return { ok: true, counts };
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			if (!isGitHubIntegrationAccessError(msg)) throw e;

			if (attempt === 0) {
				await (admin.from('project_integrations_github') as any)
					.update({ access_token: '', token_expires_at: null })
					.eq('id', integ.id);
				integ = { ...integ, access_token: '', token_expires_at: null };
				continue;
			}

			if (attempt === 1) {
				const resolved = await fetchRepositoryInstallationId(owner, repo);
				if (resolved != null && resolved !== integ.installation_id) {
					await (admin.from('project_integrations_github') as any)
						.update({
							installation_id: resolved,
							access_token: '',
							token_expires_at: null
						})
						.eq('id', integ.id);
					integ = {
						...integ,
						installation_id: resolved,
						access_token: '',
						token_expires_at: null
					};
					continue;
				}
				accessDeniedCooldownUntil.set(projectId, Date.now() + ACCESS_DENIED_COOLDOWN_MS);
				const extra =
					resolved == null
						? ' No GitHub App installation was found for this repository with your configured GITHUB_APP_ID — install the same app on the org/user that owns the repo, or fix env app credentials.'
						: '';
				return { ok: false, reason: 'github_forbidden', message: msg + extra };
			}

			accessDeniedCooldownUntil.set(projectId, Date.now() + ACCESS_DENIED_COOLDOWN_MS);
			return { ok: false, reason: 'github_forbidden', message: msg };
		}
	}
	return { ok: false, reason: 'github_forbidden', message: 'GitHub sync loop exited unexpectedly.' };
}

/** Fire-and-forget from layout: never throws. */
export async function tryGithubAutoSyncFromLayout(locals: LocalsLike, projectId: string): Promise<void> {
	try {
		const r = await githubSyncForProject(locals, projectId, {});
		if (r.ok) return;
		if (r.reason === 'github_forbidden') {
			console.warn(
				`[github auto-sync] Project ${projectId}: GitHub blocked repo API access (403).\n` +
					`  Sync retries: fresh token scoped to owner/repo, then corrected installation_id if GitHub reports a different install for this repository.\n` +
					`  If it still fails: App → Repository permissions → **Contents**: Read-only; installations → **Configure** → include this repo; org SAML: authorize the app.\n` +
					`  Details: ${r.message ?? r.reason}`
			);
			return;
		}
		if (r.reason !== 'no_integration' && r.reason !== 'forbidden' && r.reason !== 'no_session') {
			console.warn('[github auto-sync]', projectId, r);
		}
	} catch (e) {
		console.warn('[github auto-sync]', projectId, e);
	}
}

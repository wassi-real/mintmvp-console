import type { SupabaseClient } from '@supabase/supabase-js';
import { GITHUB_SYNC_INTERVAL_MS } from '$lib/github-sync-constants';
import { createServiceRoleClient } from '$lib/supabase/server';
import { isProjectStaff } from '$lib/server/roles';
import { ensureToken, fullSync } from './sync';

export { GITHUB_SYNC_INTERVAL_MS } from '$lib/github-sync-constants';

/** GitHub App token cannot read this repo (permissions or repo not granted to install). */
export function isGitHubIntegrationAccessError(message: string): boolean {
	const m = message.toLowerCase();
	return (
		m.includes('403') ||
		m.includes('resource not accessible by integration') ||
		m.includes('not accessible by integration')
	);
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

	const token = await ensureToken(admin, integration);
	try {
		const counts = await fullSync(
			admin,
			projectId,
			token,
			integration.repo_owner as string,
			integration.repo_name as string
		);
		accessDeniedCooldownUntil.delete(projectId);
		return { ok: true, counts };
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e);
		if (isGitHubIntegrationAccessError(msg)) {
			accessDeniedCooldownUntil.set(projectId, Date.now() + ACCESS_DENIED_COOLDOWN_MS);
			return { ok: false, reason: 'github_forbidden', message: msg };
		}
		throw e;
	}
}

/** Fire-and-forget from layout: never throws. */
export async function tryGithubAutoSyncFromLayout(locals: LocalsLike, projectId: string): Promise<void> {
	try {
		const r = await githubSyncForProject(locals, projectId, {});
		if (r.ok) return;
		if (r.reason === 'github_forbidden') {
			console.warn(
				`[github auto-sync] Project ${projectId}: GitHub returned 403 — the installation cannot access this repository.\n` +
					`  Fix on GitHub: App → Repository permissions → **Contents**: Read-only (required for branches/commits).\n` +
					`  Also: github.com/settings/installations → your app → **Configure** → ensure **this repo** is in the allowed list.\n` +
					`  After changing permissions, accept the update on the installation if GitHub prompts you.\n` +
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

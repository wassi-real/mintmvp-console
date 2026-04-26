import type { PageServerLoad, Actions } from './$types';
import type { Tables } from '$lib/supabase/types';
import { fail } from '@sveltejs/kit';
import { logActivity, getActorName } from '$lib/server/activity';
import { hasGitHubAppEnv, listInstallationRepos } from '$lib/server/github';
import { createServiceRoleClient } from '$lib/supabase/server';
import {
	formatGitHubPermissionHint,
	githubSyncForProject,
	isGitHubIntegrationAccessError
} from '$lib/server/github/run-sync';
import { githubManualSyncAction } from '$lib/server/github/sync-action';
import { isProjectStaff } from '$lib/server/roles';

export const load: PageServerLoad = async ({ locals, params }) => {
	const { data: integration } = await locals.supabase
		.from('project_integrations_github')
		.select('*')
		.eq('project_id', params.id)
		.maybeSingle();

	return {
		integration: integration as Tables<'project_integrations_github'> | null,
		githubConfigured: hasGitHubAppEnv()
	};
};

export const actions: Actions = {
	connect: async ({ request, locals, params }) => {
		if (!locals.session?.user?.id) return fail(401, { error: 'Unauthorized' });
		if (!(await isProjectStaff(locals.supabase, locals.session.user.id))) {
			return fail(403, { error: 'Only owners and developers can connect GitHub.' });
		}

		const form = await request.formData();
		const installation_id = parseInt(form.get('installation_id') as string, 10);

		if (!installation_id || isNaN(installation_id)) {
			return fail(400, { error: 'Installation ID is required' });
		}

		const { getInstallationToken } = await import('$lib/server/github/api');
		let token: string;
		let expires_at: string;
		try {
			const result = await getInstallationToken(installation_id);
			token = result.token;
			expires_at = result.expires_at;
		} catch (e) {
			return fail(400, { error: `Could not authenticate with GitHub: ${e instanceof Error ? e.message : 'unknown'}` });
		}

		let repos: { id: number; full_name: string; name: string; owner: { login: string } }[];
		try {
			repos = await listInstallationRepos(token);
		} catch {
			repos = [];
		}

		return { step: 'select_repo', repos, installation_id, token, expires_at };
	},

	selectRepo: async ({ request, locals, params }) => {
		if (!locals.session?.user?.id) return fail(401, { error: 'Unauthorized' });
		if (!(await isProjectStaff(locals.supabase, locals.session.user.id))) {
			return fail(403, { error: 'Only owners and developers can connect GitHub.' });
		}

		const form = await request.formData();
		const installation_id = parseInt(form.get('installation_id') as string, 10);
		const repo_owner = (form.get('repo_owner') as string)?.trim();
		const repo_name = (form.get('repo_name') as string)?.trim();

		if (!installation_id || !repo_owner || !repo_name) {
			return fail(400, { error: 'Missing required fields' });
		}

		let admin;
		try {
			admin = createServiceRoleClient();
		} catch (e) {
			return fail(500, {
				error: e instanceof Error ? e.message : 'Server is missing SUPABASE_SERVICE_ROLE_KEY for GitHub sync.'
			});
		}

		// Do not persist the connect-step token: always mint via `ensureToken` with
		// `repositories: ['owner/repo']` so GitHub scopes the installation token to this repo.
		const { error } = await (admin.from('project_integrations_github') as any).upsert(
			{
				project_id: params.id,
				installation_id,
				repo_owner,
				repo_name,
				access_token: '',
				token_expires_at: null
			},
			{ onConflict: 'project_id' }
		);

		if (error) return fail(500, { error: error.message });

		await logActivity(
			locals.supabase,
			params.id,
			`GitHub integration connected: ${repo_owner}/${repo_name}`,
			getActorName(locals.session!),
			{ installation_id, repo_owner, repo_name }
		);

		let syncCounts:
			| { branches: number; prs: number; commits: number; ciRuns: number; deployments: number }
			| undefined;
		let permissionWarning: string | undefined;
		try {
			const sync = await githubSyncForProject(locals, params.id, { force: true });
			if (sync.ok && sync.counts) syncCounts = sync.counts;
			if (!sync.ok && sync.reason === 'github_forbidden') {
				permissionWarning = formatGitHubPermissionHint(sync.message);
			} else if (!sync.ok && sync.reason !== 'no_service_role') {
				console.warn('[github] post-connect sync', sync);
			}
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			if (isGitHubIntegrationAccessError(msg)) {
				permissionWarning = formatGitHubPermissionHint(msg);
			} else {
				console.warn('[github] post-connect sync failed', e);
			}
		}

		return { success: true, syncCounts, permissionWarning };
	},

	disconnect: async ({ locals, params }) => {
		if (!locals.session?.user?.id) return fail(401, { error: 'Unauthorized' });
		if (!(await isProjectStaff(locals.supabase, locals.session.user.id))) {
			return fail(403, { error: 'Only owners and developers can disconnect GitHub.' });
		}

		let admin;
		try {
			admin = createServiceRoleClient();
		} catch (e) {
			return fail(500, {
				error: e instanceof Error ? e.message : 'Server is missing SUPABASE_SERVICE_ROLE_KEY.'
			});
		}

		const { error } = await (admin.from('project_integrations_github') as any).delete().eq('project_id', params.id);

		if (error) return fail(500, { error: error.message });

		for (const table of ['github_branches', 'github_pull_requests', 'github_commits', 'github_ci_runs', 'github_deployments']) {
			await ((admin as any).from(table) as any).delete().eq('project_id', params.id);
		}

		await logActivity(locals.supabase, params.id, 'GitHub integration disconnected', getActorName(locals.session!));

		return { success: true, disconnected: true };
	},

	sync: async ({ locals, params }) => githubManualSyncAction(locals, params.id)
};

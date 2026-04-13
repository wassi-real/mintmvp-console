import type { PageServerLoad, Actions } from './$types';
import type { Tables } from '$lib/supabase/types';
import { fail } from '@sveltejs/kit';
import { logActivity, getActorName } from '$lib/server/activity';
import { hasGitHubAppEnv, ensureToken, listInstallationRepos, fullSync } from '$lib/server/github';

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
		const form = await request.formData();
		const installation_id = parseInt(form.get('installation_id') as string, 10);
		const repo_owner = (form.get('repo_owner') as string)?.trim();
		const repo_name = (form.get('repo_name') as string)?.trim();
		const token = (form.get('token') as string)?.trim();
		const expires_at = (form.get('expires_at') as string)?.trim();

		if (!installation_id || !repo_owner || !repo_name) {
			return fail(400, { error: 'Missing required fields' });
		}

		const { error } = await (locals.supabase.from('project_integrations_github') as any).upsert(
			{
				project_id: params.id,
				installation_id,
				repo_owner,
				repo_name,
				access_token: token || '',
				token_expires_at: expires_at || null
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

		return { success: true };
	},

	sync: async ({ locals, params }) => {
		const { data: integration } = await locals.supabase
			.from('project_integrations_github')
			.select('*')
			.eq('project_id', params.id)
			.maybeSingle();

		if (!integration) return fail(400, { error: 'No GitHub integration configured' });

		try {
			const token = await ensureToken(locals.supabase, integration as any);
			const counts = await fullSync(
				locals.supabase,
				params.id,
				token,
				(integration as any).repo_owner,
				(integration as any).repo_name
			);

			await logActivity(
				locals.supabase,
				params.id,
				'GitHub sync completed',
				getActorName(locals.session!),
				counts
			);

			return { success: true, syncCounts: counts };
		} catch (e) {
			return fail(500, { error: `Sync failed: ${e instanceof Error ? e.message : 'unknown'}` });
		}
	},

	disconnect: async ({ locals, params }) => {
		const { error } = await (locals.supabase.from('project_integrations_github') as any)
			.delete()
			.eq('project_id', params.id);

		if (error) return fail(500, { error: error.message });

		for (const table of ['github_branches', 'github_pull_requests', 'github_commits', 'github_ci_runs', 'github_deployments']) {
			await (locals.supabase.from(table) as any).delete().eq('project_id', params.id);
		}

		await logActivity(locals.supabase, params.id, 'GitHub integration disconnected', getActorName(locals.session!));

		return { success: true, disconnected: true };
	}
};

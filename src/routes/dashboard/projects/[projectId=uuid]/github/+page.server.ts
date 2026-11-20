import { fail } from '@sveltejs/kit';
import { logActivity } from '#lib/server/activity.ts';
import { projectContext } from '#lib/server/context.ts';
import { VIEW_ONLY } from '#lib/server/crud.ts';
import { githubConnection, syncGithub } from '#lib/server/github.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const context = await projectContext(event);
	const { supabase, project } = context;
	const id = project.id;

	const [connection, branches, pulls, commits, runs] = await Promise.all([
		supabase
			.from('project_integrations_github')
			.select('repo_owner, repo_name, last_sync_at')
			.eq('project_id', id)
			.maybeSingle(),
		supabase
			.from('github_branches')
			.select('id, name, last_commit_sha, status, updated_at')
			.eq('project_id', id)
			.order('updated_at', { ascending: false })
			.limit(100),
		supabase
			.from('github_pull_requests')
			.select('id, gh_number, title, author, branch, status, created_at, merged_at')
			.eq('project_id', id)
			.order('created_at', { ascending: false })
			.limit(100),
		supabase
			.from('github_commits')
			.select('id, sha, message, author, committed_at')
			.eq('project_id', id)
			.order('committed_at', { ascending: false })
			.limit(100),
		supabase
			.from('github_ci_runs')
			.select('id, workflow_name, branch, status, created_at')
			.eq('project_id', id)
			.order('created_at', { ascending: false })
			.limit(10)
	]);

	const repo = connection.data;
	return {
		repo: repo ? { owner: repo.repo_owner, name: repo.repo_name, lastSyncAt: repo.last_sync_at } : null,
		branches: branches.data ?? [],
		pulls: pulls.data ?? [],
		commits: commits.data ?? [],
		recentRuns: runs.data ?? []
	};
};

export const actions: Actions = {
	sync: async (event) => {
		const context = await projectContext(event);
		if (!context.canEdit) return fail(403, { message: VIEW_ONLY });

		const connection = await githubConnection(context);
		if ('problem' in connection) return fail(400, { message: connection.problem });

		try {
			const result = await syncGithub(context, connection);
			if ('error' in result) return fail(400, { message: result.error });
			await logActivity(context, `GitHub synced: ${result.summary}`);
			return { message: `Synced from GitHub: ${result.summary}.` };
		} catch (cause) {
			console.error('github sync failed:', cause);
			return fail(500, { message: 'Could not reach GitHub. Please try again in a moment.' });
		}
	}
};

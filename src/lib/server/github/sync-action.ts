import type { Session, SupabaseClient } from '@supabase/supabase-js';
import { fail } from '@sveltejs/kit';
import { logActivity, getActorName } from '$lib/server/activity';
import { isProjectStaff } from '$lib/server/roles';
import { githubSyncForProject } from './run-sync';

type Locals = {
	supabase: SupabaseClient;
	session: Session | null;
};

/**
 * Shared POST handler for "Sync now" on GitHub integration (settings + project GitHub page).
 */
export async function githubManualSyncAction(locals: Locals, projectId: string) {
	if (!locals.session?.user?.id) return fail(401, { error: 'Unauthorized' });
	if (!(await isProjectStaff(locals.supabase, locals.session.user.id))) {
		return fail(403, { error: 'Only owners and developers can sync GitHub.' });
	}

	const { data: integration } = await locals.supabase
		.from('project_integrations_github')
		.select('id')
		.eq('project_id', projectId)
		.maybeSingle();

	if (!integration) return fail(400, { error: 'No GitHub integration configured' });

	try {
		const sync = await githubSyncForProject(locals, projectId, { force: true });
		if (!sync.ok) {
			if (sync.reason === 'github_forbidden') {
				return fail(403, {
					error:
						'GitHub blocked access (403). On the GitHub App, set repository permission Contents to Read-only, and ensure this repository is included on the installation (github.com/settings/installations).'
				});
			}
			if (sync.reason === 'no_service_role') {
				return fail(500, { error: 'Server is missing SUPABASE_SERVICE_ROLE_KEY for GitHub sync.' });
			}
			if (sync.reason === 'no_integration') {
				return fail(400, { error: 'No GitHub integration configured' });
			}
			return fail(500, { error: `Sync could not run: ${sync.reason}` });
		}

		await logActivity(
			locals.supabase,
			projectId,
			'GitHub sync completed',
			getActorName(locals.session!),
			sync.counts ?? {}
		);

		return { success: true, syncCounts: sync.counts };
	} catch (e) {
		return fail(500, { error: e instanceof Error ? e.message : 'Sync failed' });
	}
}

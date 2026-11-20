import { error, type RequestEvent } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Row } from '#lib/database.types.ts';

export type Profile = Row<'users'> & { organization_id: string };

export interface WorkspaceContext {
	supabase: SupabaseClient<Database>;
	profile: Profile;
	/** Owners and developers can change things. Clients can only look. */
	canEdit: boolean;
	isOwner: boolean;
}

export interface ProjectContext extends WorkspaceContext {
	project: Row<'projects'>;
}

/**
 * For anything under /dashboard. The server hook has already checked that the visitor is signed
 * in, has finished onboarding and has an active workspace.
 */
export function workspaceContext(event: RequestEvent): WorkspaceContext {
	const profile = event.locals.profile;
	if (!profile?.organization_id) error(401, 'Please sign in again.');
	return {
		supabase: event.locals.supabase,
		profile: profile as Profile,
		canEdit: profile.role === 'owner' || profile.role === 'developer',
		isOwner: profile.role === 'owner'
	};
}

/**
 * Loads the project named in the URL. Row level security only returns projects in the visitor's
 * active workspace, so a project from another workspace is reported as not found.
 */
export async function projectContext(event: RequestEvent): Promise<ProjectContext> {
	const context = workspaceContext(event);
	const projectId = event.params.projectId;
	if (!projectId) error(404, 'Project not found.');

	const { data: project, error: failure } = await context.supabase
		.from('projects')
		.select('*')
		.eq('id', projectId)
		.eq('organization_id', context.profile.organization_id)
		.maybeSingle();

	if (failure) error(500, 'Could not load the project. Please try again.');
	if (!project) error(404, 'Project not found.');
	return { ...context, project };
}

export function displayName(profile: Pick<Row<'users'>, 'full_name' | 'username' | 'email'>): string {
	return profile.full_name.trim() || profile.username || profile.email.split('@')[0];
}

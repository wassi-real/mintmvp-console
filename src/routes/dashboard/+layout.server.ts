import { displayName, workspaceContext } from '#lib/server/context.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const context = workspaceContext(event);
	const { supabase, profile } = context;
	const organizationId = profile.organization_id;

	const [memberships, projects, unread] = await Promise.all([
		supabase.from('organization_members').select('organization_id, role').eq('user_id', profile.id),
		supabase
			.from('projects')
			.select('id, name, status')
			.eq('organization_id', organizationId)
			.order('name'),
		supabase
			.from('notifications')
			.select('id', { count: 'exact', head: true })
			.eq('user_id', profile.id)
			.or(`organization_id.eq.${organizationId},kind.eq.workspace_invite`)
			.is('read_at', null)
	]);

	const ids = (memberships.data ?? []).map((membership) => membership.organization_id);
	const { data: organizations } = ids.length
		? await supabase.from('organizations').select('id, name').in('id', ids).order('name')
		: { data: [] };

	const roles = new Map((memberships.data ?? []).map((m) => [m.organization_id, m.role]));
	const workspaces = (organizations ?? []).map((organization) => ({
		id: organization.id,
		name: organization.name,
		role: roles.get(organization.id) ?? 'client',
		active: organization.id === organizationId
	}));

	return {
		me: {
			id: profile.id,
			name: displayName(profile),
			username: profile.username,
			email: profile.email,
			avatarUrl: profile.avatar_url,
			role: profile.role
		},
		workspace: workspaces.find((workspace) => workspace.active) ?? {
			id: organizationId,
			name: 'Workspace',
			role: profile.role,
			active: true
		},
		workspaces,
		projects: projects.data ?? [],
		unread: unread.count ?? 0,
		canEdit: context.canEdit,
		isOwner: context.isOwner
	};
};

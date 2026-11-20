import type { Option } from '#lib/constants.ts';
import type { Row } from '#lib/database.types.ts';
import { milestoneFields } from '#lib/sections.ts';
import { displayName, type ProjectContext, type WorkspaceContext } from './context.ts';

export interface Member {
	id: string;
	name: string;
	username: string | null;
	email: string;
	avatarUrl: string | null;
	role: string;
	joinedAt: string;
}

/** Everyone in the active workspace, owners first. */
export async function workspaceMembers(context: WorkspaceContext): Promise<Member[]> {
	const { data: memberships } = await context.supabase
		.from('organization_members')
		.select('user_id, role, created_at')
		.eq('organization_id', context.profile.organization_id);

	const ids = (memberships ?? []).map((membership) => membership.user_id);
	if (ids.length === 0) return [];

	const { data: users } = await context.supabase
		.from('users')
		.select('id, full_name, username, email, avatar_url')
		.in('id', ids);

	const byId = new Map((users ?? []).map((user) => [user.id, user]));
	const order: Record<string, number> = { owner: 0, developer: 1, client: 2 };

	return (memberships ?? [])
		.flatMap((membership) => {
			const user = byId.get(membership.user_id);
			if (!user) return [];
			return [
				{
					id: user.id,
					name: displayName(user as Row<'users'>),
					username: user.username,
					email: user.email,
					avatarUrl: user.avatar_url,
					role: membership.role,
					joinedAt: membership.created_at
				}
			];
		})
		.sort((a, b) => (order[a.role] ?? 9) - (order[b.role] ?? 9) || a.name.localeCompare(b.name));
}

export function memberOptions(members: readonly Member[]): Option[] {
	return members.map((member) => ({ value: member.id, label: member.name }));
}

export async function specOptions(context: ProjectContext): Promise<Option[]> {
	const { data } = await context.supabase
		.from('specs')
		.select('id, title')
		.eq('project_id', context.project.id)
		.order('title');
	return (data ?? []).map((spec) => ({ value: spec.id, label: spec.title }));
}

export async function taskOptions(context: ProjectContext): Promise<Option[]> {
	const { data } = await context.supabase
		.from('tasks')
		.select('id, title')
		.eq('project_id', context.project.id)
		.order('title')
		.limit(500);
	return (data ?? []).map((task) => ({ value: task.id, label: task.title }));
}

export async function milestoneOptions(context: ProjectContext): Promise<Option[]> {
	const { data } = await context.supabase
		.from('milestones')
		.select('id, title')
		.eq('project_id', context.project.id)
		.order('created_at');
	return (data ?? []).map((milestone) => ({ value: milestone.id, label: milestone.title }));
}

export async function milestoneFieldsFor(context: ProjectContext) {
	const [members, specs] = await Promise.all([workspaceMembers(context), specOptions(context)]);
	return milestoneFields({ members: memberOptions(members), specs });
}
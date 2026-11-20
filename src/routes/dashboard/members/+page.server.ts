import { fail } from '@sveltejs/kit';
import { INVITE_ROLES, ROLES } from '#lib/constants.ts';
import { notify } from '#lib/server/activity.ts';
import { workspaceContext } from '#lib/server/context.ts';
import { workspaceMembers } from '#lib/server/lookups.ts';
import { isEmail, isUuid, text } from '#lib/server/validate.ts';
import type { Actions, PageServerLoad } from './$types';

const OWNERS_ONLY = 'Only workspace owners can do this.';

function rpcMessage(error: { message: string }, fallback: string): string {
	if (/at least one owner/i.test(error.message)) {
		return 'A workspace needs at least one owner. Make someone else an owner first.';
	}
	if (/not a member/i.test(error.message)) return 'That person is no longer in this workspace.';
	if (/only workspace owners/i.test(error.message)) return OWNERS_ONLY;
	console.error('workspace rpc failed:', error.message);
	return fallback;
}

export const load: PageServerLoad = async (event) => {
	const context = workspaceContext(event);
	const [members, invites] = await Promise.all([
		workspaceMembers(context),
		context.isOwner
			? context.supabase
					.from('workspace_invites')
					.select('id, email, role, created_at, expires_at')
					.eq('organization_id', context.profile.organization_id)
					.is('accepted_at', null)
					.is('revoked_at', null)
					.order('created_at', { ascending: false })
			: Promise.resolve({ data: [] })
	]);

	return { members, invites: invites.data ?? [] };
};

export const actions: Actions = {
	invite: async (event) => {
		const context = workspaceContext(event);
		if (!context.isOwner) return fail(403, { message: OWNERS_ONLY });

		const form = await event.request.formData();
		const email = text(form, 'email').toLowerCase();
		const role = text(form, 'role');
		const errors: Record<string, string> = {};
		if (!isEmail(email)) errors.email = 'Enter a valid email address.';
		if (!INVITE_ROLES.some((option) => option.value === role)) errors.role = 'Choose a role.';
		if (Object.keys(errors).length) {
			return fail(400, { message: 'Please fix the highlighted fields.', errors });
		}

		const members = await workspaceMembers(context);
		if (members.some((member) => member.email.toLowerCase() === email)) {
			return fail(400, {
				message: 'Please fix the highlighted fields.',
				errors: { email: 'That person is already in this workspace.' }
			});
		}

		const { error } = await context.supabase.from('workspace_invites').insert({
			organization_id: context.profile.organization_id,
			email,
			role,
			invited_by: context.profile.id
		});
		if (error?.code === '23505') {
			return fail(400, {
				message: 'Please fix the highlighted fields.',
				errors: { email: 'That email address already has an open invitation.' }
			});
		}
		if (error) {
			console.error('invite failed:', error.message);
			return fail(400, { message: 'Could not create the invitation. Please try again.' });
		}
		return { message: `Invitation created for ${email}.` };
	},

	revoke: async (event) => {
		const context = workspaceContext(event);
		if (!context.isOwner) return fail(403, { message: OWNERS_ONLY });
		const id = text(await event.request.formData(), 'id');
		if (!isUuid(id)) return fail(400, { message: 'That invitation could not be found.' });

		const { error } = await context.supabase
			.from('workspace_invites')
			.update({ revoked_at: new Date().toISOString() })
			.eq('id', id)
			.eq('organization_id', context.profile.organization_id);
		if (error) return fail(400, { message: 'Could not cancel the invitation. Please try again.' });
		return { message: 'Invitation cancelled.' };
	},

	role: async (event) => {
		const context = workspaceContext(event);
		if (!context.isOwner) return fail(403, { message: OWNERS_ONLY });
		const form = await event.request.formData();
		const userId = text(form, 'user_id');
		const role = text(form, 'role');
		if (!isUuid(userId) || !ROLES.some((option) => option.value === role)) {
			return fail(400, { message: 'Choose a role from the list.' });
		}

		const { error } = await context.supabase.rpc('set_member_role', {
			p_user_id: userId,
			p_role: role
		});
		if (error) return fail(400, { message: rpcMessage(error, 'Could not change the role.') });

		await notify(context, {
			userId,
			kind: 'role_changed',
			title: `Your role is now ${ROLES.find((option) => option.value === role)?.label ?? role}`,
			link: '/dashboard/members'
		});
		return { message: 'Role updated.' };
	},

	remove: async (event) => {
		const context = workspaceContext(event);
		if (!context.isOwner) return fail(403, { message: OWNERS_ONLY });
		const userId = text(await event.request.formData(), 'id');
		if (!isUuid(userId)) return fail(400, { message: 'That person could not be found.' });
		if (userId === context.profile.id) {
			return fail(400, { message: 'To leave the workspace yourself, use Workspace settings.' });
		}

		const { error } = await context.supabase.rpc('remove_member', { p_user_id: userId });
		if (error) return fail(400, { message: rpcMessage(error, 'Could not remove that person.') });
		return { message: 'Removed from the workspace.' };
	}
};

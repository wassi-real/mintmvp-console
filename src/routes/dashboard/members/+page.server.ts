import { fail } from '@sveltejs/kit';
import { INVITE_ROLES, ROLES, USERNAME_PATTERN } from '#lib/constants.ts';
import { notify } from '#lib/server/activity.ts';
import { displayName, workspaceContext } from '#lib/server/context.ts';
import { workspaceMembers } from '#lib/server/lookups.ts';
import { isEmail, isUuid, text } from '#lib/server/validate.ts';
import { getServiceClient } from '#lib/server/supabase.ts';
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
		const who = text(form, 'who');
		const role = text(form, 'role');
		const errors: Record<string, string> = {};
		if (!INVITE_ROLES.some((option) => option.value === role)) errors.role = 'Choose a role.';

		const lookup = who.includes('@')
			? { column: 'email' as const, value: who.toLowerCase(), ok: isEmail(who.toLowerCase()) }
			: {
					column: 'username' as const,
					value: who.replace(/^@/, '').toLowerCase(),
					ok: USERNAME_PATTERN.test(who.replace(/^@/, '').toLowerCase())
				};
		if (!who || !lookup.ok) {
			errors.who = who.includes('@')
				? 'Enter a valid email address.'
				: 'Enter an email address, or a username with letters, numbers and underscores.';
		}
		if (Object.keys(errors).length) {
			return fail(400, { message: 'Please fix the highlighted fields.', errors });
		}

		const pattern = lookup.value.replace(/[%_\\]/g, (character) => `\\${character}`);
		const { data: account } = await getServiceClient()
			.from('users')
			.select('id, email, full_name, username')
			.ilike(lookup.column, pattern)
			.limit(1)
			.maybeSingle();
		if (!account?.email) {
			return fail(400, {
				message: 'Please fix the highlighted fields.',
				errors: { who: 'That person does not have an account, so they cannot be invited.' }
			});
		}

		const email = account.email.toLowerCase();
		const members = await workspaceMembers(context);
		if (members.some((member) => member.id === account.id || member.email.toLowerCase() === email)) {
			return fail(400, {
				message: 'Please fix the highlighted fields.',
				errors: { who: 'That person is already in this workspace.' }
			});
		}

		const { data: invite, error } = await context.supabase
			.from('workspace_invites')
			.insert({
				organization_id: context.profile.organization_id,
				email,
				role,
				invited_by: context.profile.id
			})
			.select('id')
			.single();
		if (error?.code === '23505') {
			return fail(400, {
				message: 'Please fix the highlighted fields.',
				errors: { who: 'That person already has an open invitation.' }
			});
		}
		if (error || !invite) {
			console.error('invite failed:', error?.message);
			return fail(400, { message: 'Could not create the invitation. Please try again.' });
		}

		const { data: workspace } = await context.supabase
			.from('organizations')
			.select('name')
			.eq('id', context.profile.organization_id)
			.maybeSingle();
		const workspaceName = workspace?.name ?? 'a workspace';
		const roleLabel = ROLES.find((option) => option.value === role)?.label ?? role;
		const person = displayName(account);

		const emailed = await notify(context, {
			userId: account.id,
			kind: 'workspace_invite',
			title: `${displayName(context.profile)} invited you to ${workspaceName}`,
			body: `Join as ${roleLabel}. The invitation stays open for 14 days.`,
			link: `/invite/${invite.id}`,
			outsideWorkspace: true
		});

		return {
			message: emailed
				? `Invitation sent to ${person}. They have an email and a notification.`
				: `Invitation saved for ${person}. They will see a notification. The email was not sent — set RESEND_API_KEY and RESEND_FROM.`
		};
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

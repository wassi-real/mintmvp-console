import { fail, redirect } from '@sveltejs/kit';
import { workspaceContext } from '#lib/server/context.ts';
import { isUuid, text } from '#lib/server/validate.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { supabase, profile } = workspaceContext(event);
	const [invites, members, projects] = await Promise.all([
		supabase.rpc('my_pending_invites'),
		supabase
			.from('organization_members')
			.select('user_id', { count: 'exact', head: true })
			.eq('organization_id', profile.organization_id),
		supabase
			.from('projects')
			.select('id', { count: 'exact', head: true })
			.eq('organization_id', profile.organization_id)
	]);
	return {
		invites: invites.data ?? [],
		memberCount: members.count ?? 0,
		projectCount: projects.count ?? 0
	};
};

export const actions: Actions = {
	rename: async (event) => {
		const context = workspaceContext(event);
		if (!context.isOwner) return fail(403, { message: 'Only workspace owners can rename it.' });

		const name = text(await event.request.formData(), 'name');
		if (name.length < 2 || name.length > 80) {
			return fail(400, {
				message: 'Please fix the highlighted fields.',
				errors: { name: 'Use 2 to 80 characters.' }
			});
		}
		const { error } = await context.supabase
			.from('organizations')
			.update({ name })
			.eq('id', context.profile.organization_id);
		if (error) return fail(400, { message: 'Could not rename the workspace. Please try again.' });
		return { message: 'Workspace renamed.' };
	},

	create: async (event) => {
		const context = workspaceContext(event);
		const name = text(await event.request.formData(), 'name');
		if (name.length < 2 || name.length > 80) {
			return fail(400, {
				message: 'Please fix the highlighted fields.',
				errors: { name: 'Use 2 to 80 characters.' }
			});
		}
		const { error } = await context.supabase.rpc('create_workspace', { p_name: name });
		if (error) {
			console.error('create_workspace failed:', error.message);
			return fail(400, { message: 'Could not create the workspace. Please try again.' });
		}
		redirect(303, '/dashboard');
	},

	accept: async (event) => {
		const context = workspaceContext(event);
		const id = text(await event.request.formData(), 'id');
		if (!isUuid(id)) return fail(400, { message: 'That invitation could not be found.' });
		const { error } = await context.supabase.rpc('accept_invite', { p_invite_id: id });
		if (error) {
			return fail(400, { message: 'That invitation is no longer valid. Ask for a new one.' });
		}
		redirect(303, '/dashboard');
	},

	leave: async (event) => {
		const context = workspaceContext(event);
		const { error } = await context.supabase.rpc('remove_member', {
			p_user_id: context.profile.id
		});
		if (error) {
			return fail(400, {
				message: /at least one owner/i.test(error.message)
					? 'You are the only owner. Make someone else an owner before you leave.'
					: 'Could not leave the workspace. Please try again.'
			});
		}
		// The next page load picks another workspace, or asks the person to create one.
		redirect(303, '/dashboard');
	}
};

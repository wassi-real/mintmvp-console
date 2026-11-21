import { fail } from '@sveltejs/kit';
import { workspaceContext } from '#lib/server/context.ts';
import { isUuid, text } from '#lib/server/validate.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { supabase, profile } = workspaceContext(event);
	const { data } = await supabase
		.from('notifications')
		.select('id, kind, title, body, link, created_at, read_at')
		.eq('user_id', profile.id)
		.or(`organization_id.eq.${profile.organization_id},kind.eq.workspace_invite`)
		.order('created_at', { ascending: false })
		.limit(200);
	return { notifications: data ?? [] };
};

export const actions: Actions = {
	read: async (event) => {
		const { supabase, profile } = workspaceContext(event);
		const id = text(await event.request.formData(), 'id');
		if (!isUuid(id)) return fail(400, { message: 'That notification could not be found.' });
		await supabase
			.from('notifications')
			.update({ read_at: new Date().toISOString() })
			.eq('id', id)
			.eq('user_id', profile.id);
		return {};
	},
	readAll: async (event) => {
		const { supabase, profile } = workspaceContext(event);
		const { error } = await supabase
			.from('notifications')
			.update({ read_at: new Date().toISOString() })
			.eq('user_id', profile.id)
			.eq('organization_id', profile.organization_id)
			.is('read_at', null);
		if (error) return fail(400, { message: 'Could not update your notifications. Please try again.' });
		return { message: 'All notifications marked as read.' };
	},
	delete: async (event) => {
		const { supabase, profile } = workspaceContext(event);
		const id = text(await event.request.formData(), 'id');
		if (!isUuid(id)) return fail(400, { message: 'That notification could not be found.' });
		await supabase.from('notifications').delete().eq('id', id).eq('user_id', profile.id);
		return { message: 'Notification removed.' };
	},
	clear: async (event) => {
		const { supabase, profile } = workspaceContext(event);
		const { error } = await supabase
			.from('notifications')
			.delete()
			.eq('user_id', profile.id)
			.eq('organization_id', profile.organization_id)
			.not('read_at', 'is', null);
		if (error) return fail(400, { message: 'Could not clear your notifications. Please try again.' });
		return { message: 'Read notifications cleared.' };
	}
};

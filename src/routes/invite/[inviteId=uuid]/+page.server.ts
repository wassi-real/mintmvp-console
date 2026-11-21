import { redirect } from '@sveltejs/kit';
import { safeNext } from '#lib/server/redirects.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const next = safeNext(`/invite/${event.params.inviteId}`, '/dashboard');
	const user = await event.locals.getUser();
	if (!user) redirect(303, `/auth?next=${encodeURIComponent(next)}`);

	const { error } = await event.locals.supabase.rpc('accept_invite', {
		p_invite_id: event.params.inviteId
	});
	if (error) return { failed: true as const };
	redirect(303, '/dashboard');
};

import { normalizeUsername, usernameProblem } from '#lib/server/profile.ts';
import type { RequestHandler } from './$types';

/** Live "is this username free?" check used while typing. Signed-in users only. */
export const GET: RequestHandler = async ({ url, locals }) => {
	const user = await locals.getUser();
	if (!user) return Response.json({ available: false, message: 'Please sign in.' }, { status: 401 });

	const username = normalizeUsername(url.searchParams.get('value') ?? '');
	const problem = usernameProblem(username);
	if (problem) return Response.json({ available: false, message: problem });

	const { data, error } = await locals.supabase.rpc('username_available', { p_username: username });
	if (error) {
		console.error('username_available failed:', error.message);
		return Response.json(
			{ available: false, message: 'Could not check that username. Try again.' },
			{ status: 500 }
		);
	}

	return Response.json({
		available: data === true,
		message: data === true ? `@${username} is available.` : 'That username is already taken.'
	});
};

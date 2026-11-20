import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// POST only, so a link or image on another site cannot log someone out.
export const POST: RequestHandler = async ({ locals }) => {
	await locals.supabase.auth.signOut();
	redirect(303, '/auth?mode=login&notice=signedout');
};

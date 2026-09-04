import { json, type RequestHandler } from '@sveltejs/kit';
import { githubSyncForProject } from '$lib/server/github/run-sync';

/**
 * Background GitHub → DB sync, triggered by the project layout after the page paints.
 *
 * This used to run inside the layout `load`, which meant every project navigation waited on
 * GitHub's API. Keeping it here lets the page render immediately and refresh only if the sync
 * actually pulled something new.
 */
export const POST: RequestHandler = async ({ locals, params }) => {
	if (!locals.session) return json({ ok: false, changed: false }, { status: 401 });

	try {
		const result = await githubSyncForProject(locals, params.id!, {});
		// `skipped` means the sync interval hasn't elapsed, so nothing in the DB moved.
		const changed = result.ok && !result.skipped;
		return json({ ok: result.ok, changed });
	} catch {
		return json({ ok: false, changed: false });
	}
};

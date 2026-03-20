import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import { createServiceRoleClient } from '$lib/supabase/server';
import { validateApiKey } from '$lib/server/api-keys';

export type ApiContext = {
	supabase: ReturnType<typeof createServiceRoleClient>;
	projectId: string;
};

/**
 * Authenticates an API request via Bearer token and confirms the key
 * belongs to the project in the URL params. Returns the context or
 * a JSON error response.
 */
export async function authenticateApi(
	event: RequestEvent
): Promise<ApiContext | Response> {
	const authHeader = event.request.headers.get('authorization') ?? '';
	const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

	if (!token) {
		return json({ error: 'Missing API key. Use Authorization: Bearer mint_...' }, { status: 401 });
	}

	let supabase;
	try {
		supabase = createServiceRoleClient();
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Server misconfiguration';
		return json({ error: msg }, { status: 500 });
	}

	const result = await validateApiKey(supabase, token);

	if (!result) {
		return json({ error: 'Invalid API key' }, { status: 401 });
	}

	const urlProjectId = event.params.id;
	if (urlProjectId && result.projectId !== urlProjectId) {
		return json({ error: 'API key does not have access to this project' }, { status: 403 });
	}

	return { supabase, projectId: result.projectId };
}

/** Type guard to check if authenticateApi returned an error Response */
export function isErrorResponse(ctx: ApiContext | Response): ctx is Response {
	return ctx instanceof Response;
}

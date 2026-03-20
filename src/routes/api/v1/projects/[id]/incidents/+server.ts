import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateApi, isErrorResponse } from '../../../auth';
import { normalizeIncidentSeverity, normalizeIncidentStatus } from '$lib/server/api-enums';

export const GET: RequestHandler = async (event) => {
	const ctx = await authenticateApi(event);
	if (isErrorResponse(ctx)) return ctx;

	const { data, error } = await ctx.supabase
		.from('incidents')
		.select('*')
		.eq('project_id', ctx.projectId)
		.order('created_at', { ascending: false });

	if (error) return json({ error: error.message }, { status: 500 });
	return json({ data });
};

export const POST: RequestHandler = async (event) => {
	const ctx = await authenticateApi(event);
	if (isErrorResponse(ctx)) return ctx;

	const body = await event.request.json().catch(() => null);
	if (!body?.title) return json({ error: 'title is required' }, { status: 400 });

	const sevRaw = body.severity !== undefined && body.severity !== null ? body.severity : 'medium';
	const sv = normalizeIncidentSeverity(sevRaw);
	if (!sv.ok) return json({ error: sv.error }, { status: 400 });

	const statRaw = body.status !== undefined && body.status !== null ? body.status : 'open';
	const st = normalizeIncidentStatus(statRaw);
	if (!st.ok) return json({ error: st.error }, { status: 400 });

	const { data, error } = await (ctx.supabase.from('incidents') as any)
		.insert({
			project_id: ctx.projectId,
			title: body.title,
			severity: sv.value,
			status: st.value,
			description: body.description ?? null
		})
		.select()
		.single();

	if (error) return json({ error: error.message }, { status: 500 });
	return json({ data }, { status: 201 });
};

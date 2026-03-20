import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateApi, isErrorResponse } from '../../../auth';
import { normalizeSpecStatus } from '$lib/server/api-enums';

export const GET: RequestHandler = async (event) => {
	const ctx = await authenticateApi(event);
	if (isErrorResponse(ctx)) return ctx;

	const { data, error } = await ctx.supabase
		.from('specs')
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

	const statusRaw = body.status !== undefined && body.status !== null ? body.status : 'draft';
	const st = normalizeSpecStatus(statusRaw);
	if (!st.ok) return json({ error: st.error }, { status: 400 });

	const { data, error } = await (ctx.supabase.from('specs') as any)
		.insert({
			project_id: ctx.projectId,
			title: body.title,
			summary: body.summary ?? null,
			goal: body.goal ?? null,
			acceptance_criteria: body.acceptance_criteria ?? null,
			edge_cases: body.edge_cases ?? null,
			regression_risks: body.regression_risks ?? null,
			status: st.value
		})
		.select()
		.single();

	if (error) return json({ error: error.message }, { status: 500 });
	return json({ data }, { status: 201 });
};

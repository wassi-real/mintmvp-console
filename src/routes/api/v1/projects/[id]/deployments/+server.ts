import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateApi, isErrorResponse } from '../../../auth';

export const GET: RequestHandler = async (event) => {
	const ctx = await authenticateApi(event);
	if (isErrorResponse(ctx)) return ctx;

	const { data, error } = await ctx.supabase
		.from('deployments')
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
	if (!body?.version) return json({ error: 'version is required' }, { status: 400 });

	const { data, error } = await (ctx.supabase.from('deployments') as any)
		.insert({
			project_id: ctx.projectId,
			version: body.version,
			environment: body.environment ?? 'staging',
			status: body.status ?? 'pending',
			notes: body.notes ?? null
		})
		.select()
		.single();

	if (error) return json({ error: error.message }, { status: 500 });
	return json({ data }, { status: 201 });
};

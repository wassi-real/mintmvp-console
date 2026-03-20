import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateApi, isErrorResponse } from '../../../auth';

export const GET: RequestHandler = async (event) => {
	const ctx = await authenticateApi(event);
	if (isErrorResponse(ctx)) return ctx;

	const { data, error } = await ctx.supabase
		.from('tests')
		.select('*')
		.eq('project_id', ctx.projectId)
		.order('last_run', { ascending: false, nullsFirst: false });

	if (error) return json({ error: error.message }, { status: 500 });
	return json({ data });
};

export const POST: RequestHandler = async (event) => {
	const ctx = await authenticateApi(event);
	if (isErrorResponse(ctx)) return ctx;

	const body = await event.request.json().catch(() => null);
	if (!body?.name) return json({ error: 'name is required' }, { status: 400 });

	const { data, error } = await (ctx.supabase.from('tests') as any)
		.insert({
			project_id: ctx.projectId,
			name: body.name,
			type: body.type ?? 'manual',
			status: body.status ?? 'pending',
			notes: body.notes ?? null,
			last_run: body.status && body.status !== 'pending' ? new Date().toISOString() : null
		})
		.select()
		.single();

	if (error) return json({ error: error.message }, { status: 500 });
	return json({ data }, { status: 201 });
};

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateApi, isErrorResponse } from '../../../auth';

export const GET: RequestHandler = async (event) => {
	const ctx = await authenticateApi(event);
	if (isErrorResponse(ctx)) return ctx;

	const { data, error } = await ctx.supabase
		.from('tasks')
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

	const { data, error } = await (ctx.supabase.from('tasks') as any)
		.insert({
			project_id: ctx.projectId,
			title: body.title,
			description: body.description ?? null,
			status: body.status ?? 'backlog',
			priority: body.priority ?? 'medium',
			assignee: body.assignee ?? null
		})
		.select()
		.single();

	if (error) return json({ error: error.message }, { status: 500 });
	return json({ data }, { status: 201 });
};

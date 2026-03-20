import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateApi, isErrorResponse } from '../../../auth';
import {
	normalizeOptionalSpecId,
	normalizeTaskPriority,
	normalizeTaskStatus
} from '$lib/server/api-enums';

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

	let specId: string | null | undefined = undefined;
	if (Object.prototype.hasOwnProperty.call(body, 'spec_id')) {
		const sid = normalizeOptionalSpecId(body.spec_id, 'spec_id');
		if (!sid.ok) return json({ error: sid.error }, { status: 400 });
		specId = sid.value;
	}

	const statusRaw = body.status !== undefined && body.status !== null ? body.status : 'backlog';
	const ts = normalizeTaskStatus(statusRaw);
	if (!ts.ok) return json({ error: ts.error }, { status: 400 });

	const priRaw = body.priority !== undefined && body.priority !== null ? body.priority : 'medium';
	const pr = normalizeTaskPriority(priRaw);
	if (!pr.ok) return json({ error: pr.error }, { status: 400 });

	const { data, error } = await (ctx.supabase.from('tasks') as any)
		.insert({
			project_id: ctx.projectId,
			title: body.title,
			description: body.description ?? null,
			status: ts.value,
			priority: pr.value,
			assignee: body.assignee ?? null,
			...(specId !== undefined ? { spec_id: specId } : {})
		})
		.select()
		.single();

	if (error) return json({ error: error.message }, { status: 500 });
	return json({ data }, { status: 201 });
};

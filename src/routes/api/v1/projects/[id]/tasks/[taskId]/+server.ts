import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateApi, isErrorResponse } from '../../../../auth';
import {
	normalizeOptionalSpecId,
	normalizeTaskPriority,
	normalizeTaskStatus
} from '$lib/server/api-enums';

const UPDATE_FIELDS = ['title', 'description', 'status', 'priority', 'assignee', 'spec_id'] as const;

function buildPatch(body: Record<string, unknown>) {
	const patch: Record<string, unknown> = {};
	for (const key of UPDATE_FIELDS) {
		if (Object.prototype.hasOwnProperty.call(body, key)) patch[key] = body[key];
	}
	return patch;
}

export const GET: RequestHandler = async (event) => {
	const ctx = await authenticateApi(event);
	if (isErrorResponse(ctx)) return ctx;

	const taskId = event.params.taskId?.trim();
	if (!taskId) return json({ error: 'task id is required' }, { status: 400 });

	const { data, error } = await ctx.supabase
		.from('tasks')
		.select('*')
		.eq('id', taskId)
		.eq('project_id', ctx.projectId)
		.maybeSingle();

	if (error) return json({ error: error.message }, { status: 500 });
	if (!data) return json({ error: 'Task not found' }, { status: 404 });
	return json({ data });
};

export const PATCH: RequestHandler = async (event) => {
	const ctx = await authenticateApi(event);
	if (isErrorResponse(ctx)) return ctx;

	const taskId = event.params.taskId?.trim();
	if (!taskId) return json({ error: 'task id is required' }, { status: 400 });

	const body = (await event.request.json().catch(() => null)) as Record<string, unknown> | null;
	if (!body || typeof body !== 'object') return json({ error: 'JSON body is required' }, { status: 400 });

	const patch = buildPatch(body);
	if (Object.keys(patch).length === 0) {
		return json({ error: `No updatable fields. Allowed: ${UPDATE_FIELDS.join(', ')}` }, { status: 400 });
	}

	if (Object.prototype.hasOwnProperty.call(patch, 'status')) {
		const ts = normalizeTaskStatus(patch.status);
		if (!ts.ok) return json({ error: ts.error }, { status: 400 });
		patch.status = ts.value;
	}
	if (Object.prototype.hasOwnProperty.call(patch, 'priority')) {
		const pr = normalizeTaskPriority(patch.priority);
		if (!pr.ok) return json({ error: pr.error }, { status: 400 });
		patch.priority = pr.value;
	}
	if (Object.prototype.hasOwnProperty.call(patch, 'spec_id')) {
		const sid = normalizeOptionalSpecId(patch.spec_id, 'spec_id');
		if (!sid.ok) return json({ error: sid.error }, { status: 400 });
		patch.spec_id = sid.value;
	}

	const { data, error } = await (ctx.supabase.from('tasks') as any)
		.update(patch)
		.eq('id', taskId)
		.eq('project_id', ctx.projectId)
		.select()
		.single();

	if (error) {
		if (error.code === 'PGRST116') return json({ error: 'Task not found' }, { status: 404 });
		return json({ error: error.message }, { status: 500 });
	}
	return json({ data });
};

export const DELETE: RequestHandler = async (event) => {
	const ctx = await authenticateApi(event);
	if (isErrorResponse(ctx)) return ctx;

	const taskId = event.params.taskId?.trim();
	if (!taskId) return json({ error: 'task id is required' }, { status: 400 });

	const { error, count } = await (ctx.supabase.from('tasks') as any)
		.delete({ count: 'exact' })
		.eq('id', taskId)
		.eq('project_id', ctx.projectId);

	if (error) return json({ error: error.message }, { status: 500 });
	if (count === 0) return json({ error: 'Task not found' }, { status: 404 });
	return json({ success: true });
};

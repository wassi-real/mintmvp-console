import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateApi, isErrorResponse } from '../../../../auth';

const UPDATE_FIELDS = ['name', 'type', 'status', 'last_run', 'notes'] as const;

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

	const testId = event.params.testId?.trim();
	if (!testId) return json({ error: 'test id is required' }, { status: 400 });

	const { data, error } = await ctx.supabase
		.from('tests')
		.select('*')
		.eq('id', testId)
		.eq('project_id', ctx.projectId)
		.maybeSingle();

	if (error) return json({ error: error.message }, { status: 500 });
	if (!data) return json({ error: 'Test not found' }, { status: 404 });
	return json({ data });
};

export const PATCH: RequestHandler = async (event) => {
	const ctx = await authenticateApi(event);
	if (isErrorResponse(ctx)) return ctx;

	const testId = event.params.testId?.trim();
	if (!testId) return json({ error: 'test id is required' }, { status: 400 });

	const body = (await event.request.json().catch(() => null)) as Record<string, unknown> | null;
	if (!body || typeof body !== 'object') return json({ error: 'JSON body is required' }, { status: 400 });

	const patch = buildPatch(body);
	if (Object.keys(patch).length === 0) {
		return json({ error: `No updatable fields. Allowed: ${UPDATE_FIELDS.join(', ')}` }, { status: 400 });
	}

	const { data, error } = await (ctx.supabase.from('tests') as any)
		.update(patch)
		.eq('id', testId)
		.eq('project_id', ctx.projectId)
		.select()
		.single();

	if (error) {
		if (error.code === 'PGRST116') return json({ error: 'Test not found' }, { status: 404 });
		return json({ error: error.message }, { status: 500 });
	}
	return json({ data });
};

export const DELETE: RequestHandler = async (event) => {
	const ctx = await authenticateApi(event);
	if (isErrorResponse(ctx)) return ctx;

	const testId = event.params.testId?.trim();
	if (!testId) return json({ error: 'test id is required' }, { status: 400 });

	const { error, count } = await (ctx.supabase.from('tests') as any)
		.delete({ count: 'exact' })
		.eq('id', testId)
		.eq('project_id', ctx.projectId);

	if (error) return json({ error: error.message }, { status: 500 });
	if (count === 0) return json({ error: 'Test not found' }, { status: 404 });
	return json({ success: true });
};

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateApi, isErrorResponse } from '../../../../auth';

const UPDATE_FIELDS = ['version', 'environment', 'status', 'notes'] as const;

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

	const deploymentId = event.params.deploymentId?.trim();
	if (!deploymentId) return json({ error: 'deployment id is required' }, { status: 400 });

	const { data, error } = await ctx.supabase
		.from('deployments')
		.select('*')
		.eq('id', deploymentId)
		.eq('project_id', ctx.projectId)
		.maybeSingle();

	if (error) return json({ error: error.message }, { status: 500 });
	if (!data) return json({ error: 'Deployment not found' }, { status: 404 });
	return json({ data });
};

export const PATCH: RequestHandler = async (event) => {
	const ctx = await authenticateApi(event);
	if (isErrorResponse(ctx)) return ctx;

	const deploymentId = event.params.deploymentId?.trim();
	if (!deploymentId) return json({ error: 'deployment id is required' }, { status: 400 });

	const body = (await event.request.json().catch(() => null)) as Record<string, unknown> | null;
	if (!body || typeof body !== 'object') return json({ error: 'JSON body is required' }, { status: 400 });

	const patch = buildPatch(body);
	if (Object.keys(patch).length === 0) {
		return json({ error: `No updatable fields. Allowed: ${UPDATE_FIELDS.join(', ')}` }, { status: 400 });
	}

	const { data, error } = await (ctx.supabase.from('deployments') as any)
		.update(patch)
		.eq('id', deploymentId)
		.eq('project_id', ctx.projectId)
		.select()
		.single();

	if (error) {
		if (error.code === 'PGRST116') return json({ error: 'Deployment not found' }, { status: 404 });
		return json({ error: error.message }, { status: 500 });
	}
	return json({ data });
};

export const DELETE: RequestHandler = async (event) => {
	const ctx = await authenticateApi(event);
	if (isErrorResponse(ctx)) return ctx;

	const deploymentId = event.params.deploymentId?.trim();
	if (!deploymentId) return json({ error: 'deployment id is required' }, { status: 400 });

	const { error, count } = await (ctx.supabase.from('deployments') as any)
		.delete({ count: 'exact' })
		.eq('id', deploymentId)
		.eq('project_id', ctx.projectId);

	if (error) return json({ error: error.message }, { status: 500 });
	if (count === 0) return json({ error: 'Deployment not found' }, { status: 404 });
	return json({ success: true });
};

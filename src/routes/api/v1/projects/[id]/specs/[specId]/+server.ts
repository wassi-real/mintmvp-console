import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateApi, isErrorResponse } from '../../../../auth';
import { normalizeSpecStatus } from '$lib/server/api-enums';

const SPEC_UPDATE_FIELDS = [
	'title',
	'summary',
	'goal',
	'acceptance_criteria',
	'edge_cases',
	'regression_risks',
	'status'
] as const;

type SpecUpdateField = (typeof SPEC_UPDATE_FIELDS)[number];

function buildSpecPatch(body: Record<string, unknown>): Partial<Record<SpecUpdateField, unknown>> {
	const patch: Partial<Record<SpecUpdateField, unknown>> = {};
	for (const key of SPEC_UPDATE_FIELDS) {
		if (Object.prototype.hasOwnProperty.call(body, key)) {
			(patch as Record<string, unknown>)[key] = body[key];
		}
	}
	return patch;
}

export const GET: RequestHandler = async (event) => {
	const ctx = await authenticateApi(event);
	if (isErrorResponse(ctx)) return ctx;

	const specId = event.params.specId?.trim();
	if (!specId) return json({ error: 'spec id is required' }, { status: 400 });

	const { data, error } = await ctx.supabase
		.from('specs')
		.select('*')
		.eq('id', specId)
		.eq('project_id', ctx.projectId)
		.maybeSingle();

	if (error) return json({ error: error.message }, { status: 500 });
	if (!data) return json({ error: 'Spec not found' }, { status: 404 });
	return json({ data });
};

export const PATCH: RequestHandler = async (event) => {
	const ctx = await authenticateApi(event);
	if (isErrorResponse(ctx)) return ctx;

	const specId = event.params.specId?.trim();
	if (!specId) return json({ error: 'spec id is required' }, { status: 400 });

	const body = (await event.request.json().catch(() => null)) as Record<string, unknown> | null;
	if (!body || typeof body !== 'object') {
		return json({ error: 'JSON body is required' }, { status: 400 });
	}

	const patch = buildSpecPatch(body);
	if (Object.keys(patch).length === 0) {
		return json(
			{
				error: `No updatable fields. Allowed: ${SPEC_UPDATE_FIELDS.join(', ')}`
			},
			{ status: 400 }
		);
	}

	if (Object.prototype.hasOwnProperty.call(patch, 'status')) {
		const st = normalizeSpecStatus(patch.status);
		if (!st.ok) return json({ error: st.error }, { status: 400 });
		patch.status = st.value;
	}

	const { data, error } = await (ctx.supabase.from('specs') as any)
		.update(patch)
		.eq('id', specId)
		.eq('project_id', ctx.projectId)
		.select()
		.single();

	if (error) {
		if (error.code === 'PGRST116') {
			return json({ error: 'Spec not found' }, { status: 404 });
		}
		return json({ error: error.message }, { status: 500 });
	}

	return json({ data });
};

export const DELETE: RequestHandler = async (event) => {
	const ctx = await authenticateApi(event);
	if (isErrorResponse(ctx)) return ctx;

	const specId = event.params.specId?.trim();
	if (!specId) return json({ error: 'spec id is required' }, { status: 400 });

	const { error, count } = await (ctx.supabase.from('specs') as any)
		.delete({ count: 'exact' })
		.eq('id', specId)
		.eq('project_id', ctx.projectId);

	if (error) return json({ error: error.message }, { status: 500 });
	if (count === 0) return json({ error: 'Spec not found' }, { status: 404 });
	return json({ success: true });
};

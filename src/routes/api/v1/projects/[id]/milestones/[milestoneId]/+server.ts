import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateApi, isErrorResponse } from '../../../../auth';
import { PHASE_DESCRIPTIONS } from '$lib/milestone-shared';
import {
	deleteMilestoneViaApi,
	fetchMilestoneWithRelations,
	updateMilestoneViaApi
} from '$lib/server/milestone-rest';

async function readObjectBody(request: Request): Promise<Record<string, unknown> | Response> {
	try {
		const text = await request.text();
		if (!text.trim()) return {};
		const parsed: unknown = JSON.parse(text);
		if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
			return json({ error: 'JSON body must be an object' }, { status: 400 });
		}
		return parsed as Record<string, unknown>;
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}
}

export const GET: RequestHandler = async (event) => {
	const ctx = await authenticateApi(event);
	if (isErrorResponse(ctx)) return ctx;

	const milestoneId = event.params.milestoneId?.trim();
	if (!milestoneId) return json({ error: 'milestone id is required' }, { status: 400 });

	const full = await fetchMilestoneWithRelations(ctx.supabase, ctx.projectId, milestoneId);
	if (!full.ok) return json({ error: 'Milestone not found' }, { status: 404 });

	return json({
		data: {
			...full.row,
			slices: full.slices,
			linked_task_ids: full.linked_task_ids
		},
		meta: { phase_descriptions: PHASE_DESCRIPTIONS }
	});
};

export const PATCH: RequestHandler = async (event) => {
	const ctx = await authenticateApi(event);
	if (isErrorResponse(ctx)) return ctx;

	const milestoneId = event.params.milestoneId?.trim();
	if (!milestoneId) return json({ error: 'milestone id is required' }, { status: 400 });

	const rawBody = await readObjectBody(event.request);
	if (rawBody instanceof Response) return rawBody;

	const updated = await updateMilestoneViaApi(ctx.supabase, ctx.projectId, milestoneId, rawBody);
	if (!updated.ok) return json({ error: updated.message }, { status: updated.status });

	const full = await fetchMilestoneWithRelations(ctx.supabase, ctx.projectId, milestoneId);
	if (!full.ok) return json({ error: 'Milestone not found' }, { status: 404 });

	return json({
		data: {
			...full.row,
			slices: full.slices,
			linked_task_ids: full.linked_task_ids
		},
		meta: { phase_descriptions: PHASE_DESCRIPTIONS }
	});
};

export const DELETE: RequestHandler = async (event) => {
	const ctx = await authenticateApi(event);
	if (isErrorResponse(ctx)) return ctx;

	const milestoneId = event.params.milestoneId?.trim();
	if (!milestoneId) return json({ error: 'milestone id is required' }, { status: 400 });

	const deleted = await deleteMilestoneViaApi(ctx.supabase, ctx.projectId, milestoneId);
	if (!deleted.ok) return json({ error: deleted.message }, { status: deleted.status });

	return json({ success: true });
};

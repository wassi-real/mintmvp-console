import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateApi, isErrorResponse } from '../../../auth';
import { PHASE_DESCRIPTIONS, sortMilestoneSlicesFromDb } from '$lib/milestone-shared';
import type { Tables } from '$lib/supabase/types';
import { createMilestoneViaApi, fetchMilestoneWithRelations } from '$lib/server/milestone-rest';

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

	const { data: rows, error } = await ctx.supabase
		.from('milestones')
		.select('*')
		.eq('project_id', ctx.projectId)
		.order('created_at', { ascending: false });

	if (error) return json({ error: error.message }, { status: 500 });

	const msList = (rows ?? []) as Tables<'milestones'>[];
	const ids = msList.map((m) => m.id);

	let sliceRows: Tables<'milestone_slices'>[] = [];
	let linkRows: { milestone_id: string; task_id: string }[] = [];

	if (ids.length > 0) {
		const [sRes, lRes] = await Promise.all([
			ctx.supabase.from('milestone_slices').select('*').in('milestone_id', ids),
			ctx.supabase.from('milestone_task_links').select('milestone_id, task_id').in('milestone_id', ids)
		]);
		if (sRes.error) return json({ error: sRes.error.message }, { status: 500 });
		if (lRes.error) return json({ error: lRes.error.message }, { status: 500 });
		sliceRows = (sRes.data ?? []) as Tables<'milestone_slices'>[];
		linkRows = (lRes.data ?? []) as { milestone_id: string; task_id: string }[];
	}

	const slicesByMs = new Map<string, Tables<'milestone_slices'>[]>();
	for (const s of sliceRows) {
		const arr = slicesByMs.get(s.milestone_id) ?? [];
		arr.push(s);
		slicesByMs.set(s.milestone_id, arr);
	}
	const linksByMs = new Map<string, string[]>();
	for (const l of linkRows) {
		const arr = linksByMs.get(l.milestone_id) ?? [];
		arr.push(l.task_id);
		linksByMs.set(l.milestone_id, arr);
	}

	const data = msList.map((m) => ({
		...m,
		slices: sortMilestoneSlicesFromDb(slicesByMs.get(m.id) ?? []),
		linked_task_ids: linksByMs.get(m.id) ?? []
	}));

	return json({
		data,
		meta: { phase_descriptions: PHASE_DESCRIPTIONS }
	});
};

export const POST: RequestHandler = async (event) => {
	const ctx = await authenticateApi(event);
	if (isErrorResponse(ctx)) return ctx;

	const rawBody = await readObjectBody(event.request);
	if (rawBody instanceof Response) return rawBody;

	const created = await createMilestoneViaApi(ctx.supabase, ctx.projectId, rawBody);
	if (!created.ok) return json({ error: created.message }, { status: created.status });

	const full = await fetchMilestoneWithRelations(ctx.supabase, ctx.projectId, created.milestoneId);
	if (!full.ok) {
		return json({ error: 'Milestone created but could not be loaded' }, { status: 500 });
	}

	return json(
		{
			data: {
				...full.row,
				slices: full.slices,
				linked_task_ids: full.linked_task_ids
			},
			meta: { phase_descriptions: PHASE_DESCRIPTIONS }
		},
		{ status: 201 }
	);
};

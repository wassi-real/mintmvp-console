import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateApi, isErrorResponse } from '../../../auth';
import { normalizeTestStatus, normalizeTestType } from '$lib/server/api-enums';

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

	const typeRaw = body.type !== undefined && body.type !== null ? body.type : 'manual';
	const tt = normalizeTestType(typeRaw);
	if (!tt.ok) return json({ error: tt.error }, { status: 400 });

	const statRaw = body.status !== undefined && body.status !== null ? body.status : 'pending';
	const st = normalizeTestStatus(statRaw);
	if (!st.ok) return json({ error: st.error }, { status: 400 });

	const lastRun =
		st.value !== 'pending' ? (body.last_run ?? new Date().toISOString()) : body.last_run ?? null;

	const { data, error } = await (ctx.supabase.from('tests') as any)
		.insert({
			project_id: ctx.projectId,
			name: body.name,
			type: tt.value,
			status: st.value,
			notes: body.notes ?? null,
			last_run: lastRun
		})
		.select()
		.single();

	if (error) return json({ error: error.message }, { status: 500 });
	return json({ data }, { status: 201 });
};

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateApi, isErrorResponse } from '../../../../auth';

const UPDATE_FIELDS = ['title', 'content', 'folder_id'] as const;

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

	const reportId = event.params.reportId?.trim();
	if (!reportId) return json({ error: 'report id is required' }, { status: 400 });

	const { data, error } = await ctx.supabase
		.from('reports')
		.select('*')
		.eq('id', reportId)
		.eq('project_id', ctx.projectId)
		.maybeSingle();

	if (error) return json({ error: error.message }, { status: 500 });
	if (!data) return json({ error: 'Report not found' }, { status: 404 });

	let meta: { folder: Record<string, unknown> | null } = { folder: null };
	const row = data as { folder_id?: string | null };
	if (row.folder_id) {
		const { data: fo } = await ctx.supabase
			.from('report_folders')
			.select('*')
			.eq('id', row.folder_id)
			.eq('project_id', ctx.projectId)
			.maybeSingle();
		meta = { folder: fo ?? null };
	}

	return json({ data, meta });
};

export const PATCH: RequestHandler = async (event) => {
	const ctx = await authenticateApi(event);
	if (isErrorResponse(ctx)) return ctx;

	const reportId = event.params.reportId?.trim();
	if (!reportId) return json({ error: 'report id is required' }, { status: 400 });

	const body = (await event.request.json().catch(() => null)) as Record<string, unknown> | null;
	if (!body || typeof body !== 'object') return json({ error: 'JSON body is required' }, { status: 400 });

	const patch = buildPatch(body);
	if (Object.keys(patch).length === 0) {
		return json({ error: `No updatable fields. Allowed: ${UPDATE_FIELDS.join(', ')}` }, { status: 400 });
	}

	if (Object.prototype.hasOwnProperty.call(patch, 'folder_id')) {
		const raw = patch.folder_id;
		if (raw === null || raw === '') {
			patch.folder_id = null;
		} else {
			const fid = String(raw).trim();
			const { data: fo } = await ctx.supabase
				.from('report_folders')
				.select('id')
				.eq('id', fid)
				.eq('project_id', ctx.projectId)
				.maybeSingle();
			if (!fo) return json({ error: 'folder_id not found on this project' }, { status: 400 });
			patch.folder_id = fid;
		}
	}

	const { data, error } = await (ctx.supabase.from('reports') as any)
		.update(patch)
		.eq('id', reportId)
		.eq('project_id', ctx.projectId)
		.select()
		.single();

	if (error) {
		if (error.code === 'PGRST116') return json({ error: 'Report not found' }, { status: 404 });
		return json({ error: error.message }, { status: 500 });
	}
	return json({ data });
};

export const DELETE: RequestHandler = async (event) => {
	const ctx = await authenticateApi(event);
	if (isErrorResponse(ctx)) return ctx;

	const reportId = event.params.reportId?.trim();
	if (!reportId) return json({ error: 'report id is required' }, { status: 400 });

	const { error, count } = await (ctx.supabase.from('reports') as any)
		.delete({ count: 'exact' })
		.eq('id', reportId)
		.eq('project_id', ctx.projectId);

	if (error) return json({ error: error.message }, { status: 500 });
	if (count === 0) return json({ error: 'Report not found' }, { status: 404 });
	return json({ success: true });
};

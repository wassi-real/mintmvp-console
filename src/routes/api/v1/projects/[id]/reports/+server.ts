import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authenticateApi, isErrorResponse } from '../../../auth';

export const GET: RequestHandler = async (event) => {
	const ctx = await authenticateApi(event);
	if (isErrorResponse(ctx)) return ctx;

	const [{ data: reports, error: reportsErr }, { data: folders, error: foldersErr }] =
		await Promise.all([
			ctx.supabase
				.from('reports')
				.select('*')
				.eq('project_id', ctx.projectId)
				.order('updated_at', { ascending: false }),
			ctx.supabase
				.from('report_folders')
				.select('*')
				.eq('project_id', ctx.projectId)
				.order('sort_order', { ascending: true })
				.order('name', { ascending: true })
		]);

	if (reportsErr) return json({ error: reportsErr.message }, { status: 500 });
	if (foldersErr) return json({ error: foldersErr.message }, { status: 500 });

	const reportRows = reports ?? [];
	const folderRows = folders ?? [];

	const reports_by_folder: Record<string, typeof reportRows> = {
		uncategorized: reportRows.filter((r) => !r.folder_id)
	};
	for (const f of folderRows) {
		reports_by_folder[f.id] = reportRows.filter((r) => r.folder_id === f.id);
	}

	return json({
		data: reportRows,
		folders: folderRows,
		meta: { reports_by_folder }
	});
};

export const POST: RequestHandler = async (event) => {
	const ctx = await authenticateApi(event);
	if (isErrorResponse(ctx)) return ctx;

	const body = await event.request.json().catch(() => null);
	if (!body?.title) return json({ error: 'title is required' }, { status: 400 });

	let folder_id: string | null = null;
	if (body.folder_id !== undefined && body.folder_id !== null && body.folder_id !== '') {
		const fid = String(body.folder_id).trim();
		const { data: fo } = await ctx.supabase
			.from('report_folders')
			.select('id')
			.eq('id', fid)
			.eq('project_id', ctx.projectId)
			.maybeSingle();
		if (!fo) return json({ error: 'folder_id not found on this project' }, { status: 400 });
		folder_id = fid;
	}

	const { data, error } = await (ctx.supabase.from('reports') as any)
		.insert({
			project_id: ctx.projectId,
			folder_id,
			title: body.title,
			content: body.content ?? '',
			created_by: 'api'
		})
		.select()
		.single();

	if (error) return json({ error: error.message }, { status: 500 });
	return json({ data }, { status: 201 });
};

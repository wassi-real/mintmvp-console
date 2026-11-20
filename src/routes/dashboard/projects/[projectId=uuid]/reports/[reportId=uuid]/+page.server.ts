import { error, redirect } from '@sveltejs/kit';
import { reportFields } from '#lib/sections.ts';
import { projectContext, type ProjectContext } from '#lib/server/context.ts';
import { crudActions } from '#lib/server/crud.ts';
import { renderMarkdown } from '#lib/server/markdown.ts';
import type { Actions, PageServerLoad } from './$types';

async function folderOptions(context: ProjectContext) {
	const { data } = await context.supabase
		.from('report_folders')
		.select('id, name')
		.eq('project_id', context.project.id)
		.order('sort_order')
		.order('name');
	return (data ?? []).map((folder) => ({ value: folder.id, label: folder.name }));
}

export const load: PageServerLoad = async (event) => {
	const context = await projectContext(event);
	const [report, folders] = await Promise.all([
		context.supabase
			.from('reports')
			.select('*')
			.eq('id', event.params.reportId)
			.eq('project_id', context.project.id)
			.maybeSingle(),
		folderOptions(context)
	]);
	if (report.error) {
		console.error('report load failed:', report.error.message);
		error(500, 'Could not load this report. Please try again.');
	}
	const row = report.data;
	if (!row) error(404, 'Report not found.');

	let html: string;
	try {
		html = renderMarkdown(row.content);
	} catch (cause) {
		console.error('report markdown failed:', cause);
		error(500, 'Could not render this report. Please try again.');
	}

	return {
		report: row,
		html,
		folders,
		folderName: folders.find((folder) => folder.value === row.folder_id)?.label ?? ''
	};
};

const crud = crudActions({
	table: 'reports',
	fields: async (context) => reportFields(await folderOptions(context)),
	noun: 'report',
	titleField: 'title'
});

export const actions: Actions = {
	update: crud.update,
	delete: async (event) => {
		const result = await crud.delete(event);
		if (result && 'message' in result && !('status' in result)) {
			redirect(303, `/dashboard/projects/${event.params.projectId}/reports`);
		}
		return result;
	}
};
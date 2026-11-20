import { fail } from '@sveltejs/kit';
import { reportFields, reportFolderFields } from '#lib/sections.ts';
import { logActivity } from '#lib/server/activity.ts';
import { displayName, projectContext, type ProjectContext } from '#lib/server/context.ts';
import { crudActions, dbMessage, VIEW_ONLY } from '#lib/server/crud.ts';
import { isUuid, text } from '#lib/server/validate.ts';
import type { PageServerLoad } from './$types';

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
	// The text of a report can be very large, so the list never loads it.
	const [reports, folders] = await Promise.all([
		context.supabase
			.from('reports')
			.select('id, title, folder_id, created_by, created_at, updated_at')
			.eq('project_id', context.project.id)
			.order('updated_at', { ascending: false })
			.limit(2000),
		folderOptions(context)
	]);
	return { reports: reports.data ?? [], folders };
};

const reports = crudActions({
	table: 'reports',
	fields: async (context) => reportFields(await folderOptions(context)),
	noun: 'report',
	titleField: 'title',
	prepare: (values, context, mode) =>
		mode === 'create' ? { ...values, created_by: displayName(context.profile) } : values
});

const folders = crudActions({
	table: 'report_folders',
	fields: reportFolderFields,
	noun: 'folder',
	titleField: 'name'
});

export const actions = {
	create: reports.create,
	createFolder: folders.create,
	updateFolder: folders.update,

	/**
	 * The database deletes every report inside a deleted folder. To keep them, the reports are
	 * moved out of the folder first.
	 */
	deleteFolder: async (event: Parameters<typeof reports.create>[0]) => {
		const context = await projectContext(event);
		if (!context.canEdit) return fail(403, { message: VIEW_ONLY });
		const id = text(await event.request.formData(), 'id');
		if (!isUuid(id)) return fail(400, { message: 'That folder could not be found.' });

		const { error: moveError } = await context.supabase
			.from('reports')
			.update({ folder_id: null })
			.eq('folder_id', id)
			.eq('project_id', context.project.id);
		if (moveError) return fail(400, { message: dbMessage(moveError, 'folder') });

		const { count } = await context.supabase
			.from('reports')
			.select('id', { count: 'exact', head: true })
			.eq('folder_id', id);
		if (count) {
			return fail(400, { message: 'The reports could not be moved out of the folder, so it was not deleted.' });
		}

		const { data, error } = await context.supabase
			.from('report_folders')
			.delete()
			.eq('id', id)
			.eq('project_id', context.project.id)
			.select('name')
			.maybeSingle();
		if (error) return fail(400, { message: dbMessage(error, 'folder') });
		if (!data) return fail(404, { message: 'That folder could not be found.' });
		await logActivity(context, `Folder deleted: ${data.name}`);
		return { message: 'Folder deleted. Its reports were kept.' };
	}
};
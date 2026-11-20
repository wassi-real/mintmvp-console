import { incidentFields } from '#lib/sections.ts';
import { notifyMany } from '#lib/server/activity.ts';
import { projectContext } from '#lib/server/context.ts';
import { crudActions, existingRow } from '#lib/server/crud.ts';
import { workspaceMembers } from '#lib/server/lookups.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { supabase, project } = await projectContext(event);
	const { data } = await supabase
		.from('incidents')
		.select('*')
		.eq('project_id', project.id)
		.order('created_at', { ascending: false });
	return { incidents: data ?? [] };
};

export const actions = crudActions({
	table: 'incidents',
	fields: incidentFields,
	noun: 'incident',
	titleField: 'title',
	prepare: async (values, context, mode, form) => {
		if (values.status !== 'resolved') return { ...values, resolved_at: null };
		const before = mode === 'update' ? await existingRow(context, 'incidents', form) : null;
		return {
			...values,
			resolved_at: (before?.resolved_at as string | null) ?? new Date().toISOString()
		};
	},
	after: async (row, context, mode) => {
		if (mode !== 'create') return;
		const members = await workspaceMembers(context);
		await notifyMany(
			context,
			members.filter((member) => member.role !== 'client').map((member) => member.id),
			{
				kind: 'incident',
				title: `New incident in ${context.project.name}: ${String(row.title)}`,
				body: String(row.description ?? ''),
				link: `/dashboard/projects/${context.project.id}/incidents`,
				projectId: context.project.id
			}
		);
	}
});
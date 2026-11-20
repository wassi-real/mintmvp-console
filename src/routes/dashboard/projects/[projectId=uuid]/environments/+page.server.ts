import { environmentFields } from '#lib/sections.ts';
import { projectContext } from '#lib/server/context.ts';
import { crudActions, existingRow } from '#lib/server/crud.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { supabase, project } = await projectContext(event);
	const { data } = await supabase.from('project_environments').select('*').eq('project_id', project.id);
	const order = ['production', 'staging', 'development'];
	return {
		environments: (data ?? []).sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind))
	};
};

export const actions = crudActions({
	table: 'project_environments',
	fields: environmentFields,
	noun: 'environment',
	titleField: 'kind',
	prepare: async (values, context, mode, form) => {
		const before = mode === 'update' ? await existingRow(context, 'project_environments', form) : null;
		const versionChanged = Boolean(values.current_version) && before?.current_version !== values.current_version;
		return versionChanged ? { ...values, last_deploy_at: new Date().toISOString() } : values;
	}
});
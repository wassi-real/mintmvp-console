import { specFields } from '#lib/sections.ts';
import { projectContext } from '#lib/server/context.ts';
import { crudActions } from '#lib/server/crud.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { supabase, project } = await projectContext(event);
	const { data } = await supabase
		.from('specs')
		.select('*')
		.eq('project_id', project.id)
		.order('created_at', { ascending: false });
	return { specs: data ?? [] };
};

export const actions = crudActions({
	table: 'specs',
	fields: specFields,
	noun: 'spec',
	titleField: 'title'
});
import { fail } from '@sveltejs/kit';
import { testFields } from '#lib/sections.ts';
import { logActivity } from '#lib/server/activity.ts';
import { projectContext } from '#lib/server/context.ts';
import { crudActions, existingRow, VIEW_ONLY } from '#lib/server/crud.ts';
import { specOptions, taskOptions } from '#lib/server/lookups.ts';
import { isUuid, text } from '#lib/server/validate.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const context = await projectContext(event);
	const [tests, specs, tasks] = await Promise.all([
		context.supabase
			.from('tests')
			.select('*')
			.eq('project_id', context.project.id)
			.order('name'),
		specOptions(context),
		taskOptions(context)
	]);
	return { tests: tests.data ?? [], specs, tasks };
};

const crud = crudActions({
	table: 'tests',
	fields: async (context) =>
		testFields({ specs: await specOptions(context), tasks: await taskOptions(context) }),
	noun: 'test',
	titleField: 'name',
	prepare: async (values, context, mode, form) => {
		const before = mode === 'update' ? await existingRow(context, 'tests', form) : null;
		const changed = before?.status !== values.status;
		return changed && values.status !== 'pending'
			? { ...values, last_run: new Date().toISOString() }
			: values;
	}
});

export const actions = {
	...crud,
	/** One-press "this test passed / failed". */
	result: async (event) => {
		const context = await projectContext(event);
		if (!context.canEdit) return fail(403, { message: VIEW_ONLY });
		const form = await event.request.formData();
		const id = text(form, 'id');
		const status = text(form, 'status');
		if (!isUuid(id) || (status !== 'pass' && status !== 'fail')) {
			return fail(400, { message: 'That test could not be found.' });
		}
		const { data, error } = await context.supabase
			.from('tests')
			.update({ status, last_run: new Date().toISOString() })
			.eq('id', id)
			.eq('project_id', context.project.id)
			.select('name')
			.maybeSingle();
		if (error || !data) return fail(400, { message: 'Could not record the result. Please try again.' });
		await logActivity(context, `Test ${status === 'pass' ? 'passed' : 'failed'}: ${data.name}`, { test: id });
		return { message: status === 'pass' ? 'Marked as passing.' : 'Marked as failing.' };
	}
};
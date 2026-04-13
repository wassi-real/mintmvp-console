import type { PageServerLoad, Actions } from './$types';
import type { Tables } from '$lib/supabase/types';
import { fail } from '@sveltejs/kit';
import { logActivity, getActorName } from '$lib/server/activity';

export const load: PageServerLoad = async ({ locals, params }) => {
	const [{ data: tests }, { data: specs }, { data: tasks }] = await Promise.all([
		locals.supabase
			.from('tests')
			.select('*')
			.eq('project_id', params.id)
			.order('last_run', { ascending: false, nullsFirst: false }),
		locals.supabase
			.from('specs')
			.select('id, title')
			.eq('project_id', params.id)
			.order('title'),
		locals.supabase
			.from('tasks')
			.select('id, title')
			.eq('project_id', params.id)
			.order('title')
	]);

	return {
		tests: (tests ?? []) as Tables<'tests'>[],
		specs: (specs ?? []) as { id: string; title: string }[],
		tasks: (tasks ?? []) as { id: string; title: string }[]
	};
};

export const actions: Actions = {
	create: async ({ request, locals, params }) => {
		const form = await request.formData();
		const name = (form.get('name') as string)?.trim();
		const type = (form.get('type') as string) || 'manual';
		const status = (form.get('status') as string) || 'pending';
		const notes = (form.get('notes') as string)?.trim() || null;
		const spec_id = (form.get('spec_id') as string)?.trim() || null;
		const task_id = (form.get('task_id') as string)?.trim() || null;

		if (!name) return fail(400, { error: 'Test name is required' });

		const { error } = await (locals.supabase.from('tests') as any).insert({
			project_id: params.id,
			name,
			type,
			status,
			last_run: status !== 'pending' ? new Date().toISOString() : null,
			notes,
			spec_id: spec_id || null,
			task_id: task_id || null
		});

		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, `Test added: ${name}`, getActorName(locals.session!), { test: name, type });
		return { success: true };
	},

	update: async ({ request, locals, params }) => {
		const form = await request.formData();
		const id = form.get('id') as string;
		const name = (form.get('name') as string)?.trim();
		const type = (form.get('type') as string) || 'manual';
		const status = (form.get('status') as string) || 'pending';
		const notes = (form.get('notes') as string)?.trim() || null;
		const spec_id = (form.get('spec_id') as string)?.trim() || null;
		const task_id = (form.get('task_id') as string)?.trim() || null;

		if (!id || !name) return fail(400, { error: 'ID and name are required' });

		const { error } = await (locals.supabase.from('tests') as any)
			.update({ name, type, status, notes, last_run: status !== 'pending' ? new Date().toISOString() : null, spec_id: spec_id || null, task_id: task_id || null })
			.eq('id', id);

		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, `Test updated: ${name}`, getActorName(locals.session!), { test: name });
		return { success: true };
	},

	delete: async ({ request, locals, params }) => {
		const form = await request.formData();
		const id = form.get('id') as string;
		const name = form.get('name') as string;

		if (!id) return fail(400, { error: 'ID is required' });

		const { error } = await (locals.supabase.from('tests') as any).delete().eq('id', id);

		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, `Test deleted: ${name}`, getActorName(locals.session!), { test: name });
		return { success: true };
	}
};

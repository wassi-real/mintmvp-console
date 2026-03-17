import type { PageServerLoad, Actions } from './$types';
import type { Tables } from '$lib/supabase/types';
import { fail } from '@sveltejs/kit';
import { logActivity, getActorName } from '$lib/server/activity';

export const load: PageServerLoad = async ({ locals, params }) => {
	const { data } = await locals.supabase
		.from('tasks')
		.select('*')
		.eq('project_id', params.id)
		.order('created_at', { ascending: false });

	return { tasks: (data ?? []) as Tables<'tasks'>[] };
};

export const actions: Actions = {
	create: async ({ request, locals, params }) => {
		const form = await request.formData();
		const title = (form.get('title') as string)?.trim();
		const description = (form.get('description') as string)?.trim() || null;
		const priority = (form.get('priority') as string) || 'medium';
		const assignee = (form.get('assignee') as string)?.trim() || null;
		const status = (form.get('status') as string) || 'backlog';

		if (!title) return fail(400, { error: 'Title is required' });

		const { error } = await (locals.supabase.from('tasks') as any).insert({
			project_id: params.id,
			title,
			description,
			priority,
			assignee,
			status
		});

		if (error) return fail(500, { error: error.message });

		await logActivity(locals.supabase, params.id, 'Task created', getActorName(locals.session!), { task: title });
		return { success: true };
	},

	update: async ({ request, locals, params }) => {
		const form = await request.formData();
		const taskId = form.get('taskId') as string;
		const title = (form.get('title') as string)?.trim();
		const description = (form.get('description') as string)?.trim() || null;
		const priority = (form.get('priority') as string) || 'medium';
		const assignee = (form.get('assignee') as string)?.trim() || null;
		const status = (form.get('status') as string) || 'backlog';

		if (!taskId || !title) return fail(400, { error: 'Task ID and title are required' });

		const { error } = await (locals.supabase.from('tasks') as any)
			.update({ title, description, priority, assignee, status })
			.eq('id', taskId);

		if (error) return fail(500, { error: error.message });

		await logActivity(locals.supabase, params.id, 'Task updated', getActorName(locals.session!), { task: title });
		return { success: true };
	},

	delete: async ({ request, locals, params }) => {
		const form = await request.formData();
		const taskId = form.get('taskId') as string;
		const taskTitle = form.get('taskTitle') as string;

		if (!taskId) return fail(400, { error: 'Task ID is required' });

		const { error } = await (locals.supabase.from('tasks') as any)
			.delete()
			.eq('id', taskId);

		if (error) return fail(500, { error: error.message });

		await logActivity(locals.supabase, params.id, 'Task deleted', getActorName(locals.session!), { task: taskTitle });
		return { success: true };
	},

	updateStatus: async ({ request, locals, params }) => {
		const form = await request.formData();
		const taskId = form.get('taskId') as string;
		const status = form.get('status') as string;

		if (!taskId || !status) return fail(400, { error: 'Missing taskId or status' });

		const { error } = await (locals.supabase.from('tasks') as any)
			.update({ status })
			.eq('id', taskId);

		if (error) return fail(500, { error: error.message });

		const label = status.replace(/_/g, ' ');
		await logActivity(locals.supabase, params.id, `Task moved to ${label}`, getActorName(locals.session!), { taskId });
		return { success: true };
	}
};

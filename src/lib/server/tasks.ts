import { fail, type RequestEvent } from '@sveltejs/kit';
import { TASK_STATUSES, taskStatus } from '#lib/constants.ts';
import { taskFields } from '#lib/sections.ts';
import { logActivity, notify } from './activity.ts';
import { displayName, projectContext, type ProjectContext } from './context.ts';
import { crudActions, existingRow, VIEW_ONLY } from './crud.ts';
import { memberOptions, specOptions, taskOptions, workspaceMembers } from './lookups.ts';
import { isUuid, text } from './validate.ts';

/** Requests in which the person a task is assigned to has just changed. */
const reassigned = new WeakSet<ProjectContext>();

export async function taskFieldsFor(context: ProjectContext) {
	const [members, specs, tasks] = await Promise.all([
		workspaceMembers(context),
		specOptions(context),
		taskOptions(context)
	]);
	return taskFields({ members: memberOptions(members), specs, tasks });
}

export const taskCrud = crudActions({
	table: 'tasks',
	fields: taskFieldsFor,
	noun: 'task',
	titleField: 'title',
	prepare: async (values, context, mode, form) => {
		const before = mode === 'update' ? await existingRow(context, 'tasks', form) : null;
		const next = { ...values };

		// Subtasks go one level deep: a subtask cannot have subtasks of its own.
		if (next.parent_task_id) {
			if (before && next.parent_task_id === before.id) return 'A task cannot be part of itself.';
			const { data: parent } = await context.supabase
				.from('tasks')
				.select('id, parent_task_id')
				.eq('id', String(next.parent_task_id))
				.eq('project_id', context.project.id)
				.maybeSingle();
			if (!parent) return 'That parent task could not be found.';
			if (parent.parent_task_id) return 'Choose a main task as the parent, not another subtask.';
			if (before) {
				const { count } = await context.supabase
					.from('tasks')
					.select('id', { count: 'exact', head: true })
					.eq('parent_task_id', String(before.id));
				if (count) return 'This task has subtasks of its own, so it cannot become a subtask.';
			}
		}

		// Keep the older free-text "assignee" column in step with the person chosen.
		if (next.assignee_user_id) {
			const members = await workspaceMembers(context);
			next.assignee = members.find((member) => member.id === next.assignee_user_id)?.name ?? null;
		} else {
			next.assignee = null;
		}

		if (mode === 'create') next.created_by = context.profile.id;
		if ((before?.assignee_user_id ?? null) !== (next.assignee_user_id ?? null)) {
			reassigned.add(context);
		}
		return next;
	},
	after: async (row, context) => {
		if (!reassigned.has(context) || !row.assignee_user_id) return;
		await notify(context, {
			userId: String(row.assignee_user_id),
			kind: 'task_assigned',
			title: `${displayName(context.profile)} assigned you a task: ${String(row.title)}`,
			link: `/dashboard/projects/${context.project.id}/tasks/${String(row.id)}`,
			projectId: context.project.id
		});
	}
});

/** Changes only the stage of a task (board drag and drop, quick status menus). */
export async function moveTask(event: RequestEvent) {
	const context = await projectContext(event);
	if (!context.canEdit) return fail(403, { message: VIEW_ONLY });

	const form = await event.request.formData();
	const id = text(form, 'id');
	const status = text(form, 'status');
	if (!isUuid(id) || !TASK_STATUSES.some((option) => option.value === status)) {
		return fail(400, { message: 'That task could not be moved.' });
	}

	const { data, error } = await context.supabase
		.from('tasks')
		.update({ status })
		.eq('id', id)
		.eq('project_id', context.project.id)
		.select('title')
		.maybeSingle();
	if (error || !data) return fail(400, { message: 'That task could not be moved. Please try again.' });

	await logActivity(context, `Task moved to ${taskStatus(status).label}: ${data.title}`, { task: id });
	return { message: `Moved to ${taskStatus(status).label}.` };
}

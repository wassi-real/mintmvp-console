import { error, fail, redirect } from '@sveltejs/kit';
import { sliceFields } from '#lib/sections.ts';
import { logActivity } from '#lib/server/activity.ts';
import { projectContext, type ProjectContext } from '#lib/server/context.ts';
import { crudActions, dbMessage, VIEW_ONLY } from '#lib/server/crud.ts';
import {
	memberOptions,
	milestoneFieldsFor,
	specOptions,
	workspaceMembers
} from '#lib/server/lookups.ts';
import { isUuid, text, validate } from '#lib/server/validate.ts';
import type { Actions, PageServerLoad } from './$types';

async function loadMilestone(context: ProjectContext, id: string) {
	const { data } = await context.supabase
		.from('milestones')
		.select('*')
		.eq('id', id)
		.eq('project_id', context.project.id)
		.maybeSingle();
	if (!data) error(404, 'Milestone not found.');
	return data;
}

export const load: PageServerLoad = async (event) => {
	const context = await projectContext(event);
	const { supabase, project } = context;
	const milestone = await loadMilestone(context, event.params.milestoneId);

	const [slices, links, tasks, members, specs] = await Promise.all([
		supabase
			.from('milestone_slices')
			.select('*')
			.eq('milestone_id', milestone.id)
			.order('sort_order')
			.order('created_at'),
		supabase.from('milestone_task_links').select('task_id').eq('milestone_id', milestone.id),
		supabase.from('tasks').select('id, title, status').eq('project_id', project.id).order('title').limit(2000),
		workspaceMembers(context),
		specOptions(context)
	]);

	const linkedIds = new Set((links.data ?? []).map((link) => link.task_id));
	const people = new Map(members.map((member) => [member.id, member.name]));

	return {
		milestone,
		ownerName: milestone.owner_user_id ? (people.get(milestone.owner_user_id) ?? '') : '',
		specTitle: specs.find((spec) => spec.value === milestone.spec_id)?.label ?? '',
		slices: (slices.data ?? []).map((slice) => ({
			...slice,
			ownerName: slice.owner_user_id ? (people.get(slice.owner_user_id) ?? '') : ''
		})),
		linkedTasks: (tasks.data ?? []).filter((task) => linkedIds.has(task.id)),
		taskChoices: (tasks.data ?? [])
			.filter((task) => !linkedIds.has(task.id))
			.map((task) => ({ value: task.id, label: task.title })),
		members: memberOptions(members),
		specs
	};
};

const milestoneCrud = crudActions({
	table: 'milestones',
	fields: milestoneFieldsFor,
	noun: 'milestone',
	titleField: 'title'
});

/** Checks permission and loads the milestone and the slice form definition. */
async function sliceSetup(event: Parameters<Actions[string]>[0]) {
	const context = await projectContext(event);
	if (!context.canEdit) return { failure: fail(403, { message: VIEW_ONLY }) } as const;
	const milestone = await loadMilestone(context, event.params.milestoneId ?? '');
	const fields = sliceFields({ members: memberOptions(await workspaceMembers(context)) });
	return { context, milestone, fields } as const;
}

export const actions: Actions = {
	update: milestoneCrud.update,

	delete: async (event) => {
		const result = await milestoneCrud.delete(event);
		if (result && 'message' in result && !('status' in result)) {
			redirect(303, `/dashboard/projects/${event.params.projectId}/milestones`);
		}
		return result;
	},

	createSlice: async (event) => {
		const setup = await sliceSetup(event);
		if ('failure' in setup) return setup.failure;
		const { context, milestone, fields } = setup;

		const result = validate(fields, await event.request.formData());
		if (!result.ok) return fail(400, result);

		const { data: last } = await context.supabase
			.from('milestone_slices')
			.select('sort_order')
			.eq('milestone_id', milestone.id)
			.order('sort_order', { ascending: false })
			.limit(1)
			.maybeSingle();

		const { error: failure } = await context.supabase.from('milestone_slices').insert({
			...(result.values as { title: string }),
			milestone_id: milestone.id,
			sort_order: (last?.sort_order ?? 0) + 1
		});
		if (failure) return fail(400, { message: dbMessage(failure, 'step') });
		await logActivity(context, `Step added to ${milestone.title}: ${String(result.values.title)}`, {
			milestone: milestone.id
		});
		return { message: 'Step added.' };
	},

	updateSlice: async (event) => {
		const setup = await sliceSetup(event);
		if ('failure' in setup) return setup.failure;
		const { context, milestone, fields } = setup;

		const form = await event.request.formData();
		const id = text(form, 'id');
		if (!isUuid(id)) return fail(400, { message: 'That step could not be found.' });
		const result = validate(fields, form);
		if (!result.ok) return fail(400, result);

		const { data, error: failure } = await context.supabase
			.from('milestone_slices')
			.update(result.values as { title: string })
			.eq('id', id)
			.eq('milestone_id', milestone.id)
			.select('id')
			.maybeSingle();
		if (failure) return fail(400, { message: dbMessage(failure, 'step') });
		if (!data) return fail(404, { message: 'That step could not be found.' });
		await logActivity(context, `Step updated in ${milestone.title}: ${String(result.values.title)}`, {
			milestone: milestone.id
		});
		return { message: 'Step saved.' };
	},

	sliceStatus: async (event) => {
		const setup = await sliceSetup(event);
		if ('failure' in setup) return setup.failure;
		const { context, milestone, fields } = setup;

		const form = await event.request.formData();
		const id = text(form, 'id');
		const status = text(form, 'status');
		const allowed = fields.find((field) => field.name === 'status')?.options ?? [];
		if (!isUuid(id) || !allowed.some((option) => option.value === status)) {
			return fail(400, { message: 'That step could not be updated.' });
		}
		const { error: failure } = await context.supabase
			.from('milestone_slices')
			.update({ status })
			.eq('id', id)
			.eq('milestone_id', milestone.id);
		if (failure) return fail(400, { message: dbMessage(failure, 'step') });
		return { message: 'Step updated.' };
	},

	deleteSlice: async (event) => {
		const setup = await sliceSetup(event);
		if ('failure' in setup) return setup.failure;
		const { context, milestone } = setup;

		const id = text(await event.request.formData(), 'id');
		if (!isUuid(id)) return fail(400, { message: 'That step could not be found.' });
		const { data, error: failure } = await context.supabase
			.from('milestone_slices')
			.delete()
			.eq('id', id)
			.eq('milestone_id', milestone.id)
			.select('title')
			.maybeSingle();
		if (failure) return fail(400, { message: dbMessage(failure, 'step') });
		if (!data) return fail(404, { message: 'That step could not be found.' });
		await logActivity(context, `Step deleted from ${milestone.title}: ${data.title}`, {
			milestone: milestone.id
		});
		return { message: 'Step deleted.' };
	},

	linkTask: async (event) => {
		const setup = await sliceSetup(event);
		if ('failure' in setup) return setup.failure;
		const { context, milestone } = setup;

		const taskId = text(await event.request.formData(), 'task_id');
		if (!isUuid(taskId)) return fail(400, { message: 'Choose a task from the list.' });
		const { data: task } = await context.supabase
			.from('tasks')
			.select('id')
			.eq('id', taskId)
			.eq('project_id', context.project.id)
			.maybeSingle();
		if (!task) return fail(400, { message: 'Choose a task from the list.' });

		const { error: failure } = await context.supabase
			.from('milestone_task_links')
			.insert({ milestone_id: milestone.id, task_id: taskId });
		if (failure && failure.code !== '23505') {
			return fail(400, { message: dbMessage(failure, 'task link') });
		}
		return { message: 'Task linked.' };
	},

	unlinkTask: async (event) => {
		const setup = await sliceSetup(event);
		if ('failure' in setup) return setup.failure;
		const { context, milestone } = setup;

		const taskId = text(await event.request.formData(), 'id');
		if (!isUuid(taskId)) return fail(400, { message: 'That task could not be found.' });
		await context.supabase
			.from('milestone_task_links')
			.delete()
			.eq('milestone_id', milestone.id)
			.eq('task_id', taskId);
		return { message: 'Task unlinked.' };
	}
};
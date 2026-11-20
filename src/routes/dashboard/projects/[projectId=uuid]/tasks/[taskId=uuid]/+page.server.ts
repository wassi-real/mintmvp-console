import { error, fail, redirect } from '@sveltejs/kit';
import { logActivity, notifyMany } from '#lib/server/activity.ts';
import { displayName, projectContext, type ProjectContext } from '#lib/server/context.ts';
import { VIEW_ONLY } from '#lib/server/crud.ts';
import { memberOptions, specOptions, workspaceMembers } from '#lib/server/lookups.ts';
import { moveTask, taskCrud } from '#lib/server/tasks.ts';
import { isUuid, text } from '#lib/server/validate.ts';
import type { Actions, PageServerLoad } from './$types';

async function loadTask(context: ProjectContext, taskId: string) {
	const { data: task } = await context.supabase
		.from('tasks')
		.select('*')
		.eq('id', taskId)
		.eq('project_id', context.project.id)
		.maybeSingle();
	if (!task) error(404, 'Task not found.');
	return task;
}

export const load: PageServerLoad = async (event) => {
	const context = await projectContext(event);
	const { supabase, project } = context;
	const task = await loadTask(context, event.params.taskId);

	const [others, blockedBy, blocking, comments, members, specs] = await Promise.all([
		supabase
			.from('tasks')
			.select('id, title, status, parent_task_id, assignee_user_id')
			.eq('project_id', project.id)
			.neq('id', task.id)
			.order('title')
			.limit(2000),
		supabase.from('task_dependencies').select('depends_on_task_id').eq('task_id', task.id),
		supabase.from('task_dependencies').select('task_id').eq('depends_on_task_id', task.id),
		supabase
			.from('task_comments')
			.select('id, body, author_name, author_user_id, created_at')
			.eq('task_id', task.id)
			.order('created_at'),
		workspaceMembers(context),
		specOptions(context)
	]);

	const all = others.data ?? [];
	const byId = new Map(all.map((other) => [other.id, other]));
	const people = new Map(members.map((member) => [member.id, member]));
	const pick = (ids: string[]) =>
		ids.flatMap((id) => {
			const other = byId.get(id);
			return other ? [{ id: other.id, title: other.title, status: other.status }] : [];
		});

	const blockedByIds = (blockedBy.data ?? []).map((row) => row.depends_on_task_id);
	const assignee = task.assignee_user_id ? people.get(task.assignee_user_id) : undefined;

	return {
		task,
		assignee: assignee
			? { name: assignee.name, avatarUrl: assignee.avatarUrl }
			: task.assignee
				? { name: task.assignee, avatarUrl: null }
				: null,
		parent: task.parent_task_id ? (byId.get(task.parent_task_id) ?? null) : null,
		specTitle: specs.find((spec) => spec.value === task.spec_id)?.label ?? '',
		subtasks: all
			.filter((other) => other.parent_task_id === task.id)
			.map((other) => ({
				id: other.id,
				title: other.title,
				status: other.status,
				assigneeName: other.assignee_user_id ? (people.get(other.assignee_user_id)?.name ?? '') : ''
			})),
		blockedBy: pick(blockedByIds),
		blocking: pick((blocking.data ?? []).map((row) => row.task_id)),
		/** Tasks that can still be chosen as "must be finished first". */
		candidates: all
			.filter((other) => !blockedByIds.includes(other.id))
			.map((other) => ({ value: other.id, label: other.title })),
		comments: (comments.data ?? []).map((comment) => ({
			...comment,
			avatarUrl: comment.author_user_id ? (people.get(comment.author_user_id)?.avatarUrl ?? null) : null
		})),
		members: memberOptions(members),
		specs,
		parents: all
			.filter((other) => !other.parent_task_id)
			.map((other) => ({ value: other.id, label: other.title }))
	};
};

/** True when making `taskId` wait for `dependsOn` would create a loop. */
async function wouldLoop(context: ProjectContext, taskId: string, dependsOn: string) {
	const { data: tasks } = await context.supabase
		.from('tasks')
		.select('id')
		.eq('project_id', context.project.id)
		.limit(5000);
	const ids = (tasks ?? []).map((task) => task.id);
	const { data: edges } = await context.supabase
		.from('task_dependencies')
		.select('task_id, depends_on_task_id')
		.in('task_id', ids);

	const next = new Map<string, string[]>();
	for (const edge of edges ?? []) {
		next.set(edge.task_id, [...(next.get(edge.task_id) ?? []), edge.depends_on_task_id]);
	}
	const seen = new Set<string>();
	const queue = [dependsOn];
	while (queue.length) {
		const current = queue.pop()!;
		if (current === taskId) return true;
		if (seen.has(current)) continue;
		seen.add(current);
		queue.push(...(next.get(current) ?? []));
	}
	return false;
}

export const actions: Actions = {
	update: taskCrud.update,
	move: moveTask,

	delete: async (event) => {
		const result = await taskCrud.delete(event);
		if (result && 'message' in result && !('status' in result)) {
			redirect(303, `/dashboard/projects/${event.params.projectId}/tasks`);
		}
		return result;
	},

	subtask: async (event) => {
		const context = await projectContext(event);
		if (!context.canEdit) return fail(403, { message: VIEW_ONLY });
		const parent = await loadTask(context, event.params.taskId);
		if (parent.parent_task_id) {
			return fail(400, { message: 'A subtask cannot have subtasks of its own.' });
		}
		const title = text(await event.request.formData(), 'title');
		if (!title || title.length > 200) {
			return fail(400, { message: 'Enter a name for the subtask (200 characters at most).' });
		}
		const { error: failure } = await context.supabase.from('tasks').insert({
			project_id: context.project.id,
			parent_task_id: parent.id,
			title,
			priority: parent.priority,
			created_by: context.profile.id
		});
		if (failure) return fail(400, { message: 'Could not add the subtask. Please try again.' });
		await logActivity(context, `Subtask added to ${parent.title}: ${title}`, { task: parent.id });
		return { message: 'Subtask added.' };
	},

	addDependency: async (event) => {
		const context = await projectContext(event);
		if (!context.canEdit) return fail(403, { message: VIEW_ONLY });
		const task = await loadTask(context, event.params.taskId);
		const dependsOn = text(await event.request.formData(), 'depends_on_task_id');
		if (!isUuid(dependsOn) || dependsOn === task.id) {
			return fail(400, { message: 'Choose a task from the list.' });
		}
		await loadTask(context, dependsOn);
		if (await wouldLoop(context, task.id, dependsOn)) {
			return fail(400, {
				message: 'That task is already waiting for this one, so they would block each other.'
			});
		}
		const { error: failure } = await context.supabase
			.from('task_dependencies')
			.insert({ task_id: task.id, depends_on_task_id: dependsOn });
		if (failure && failure.code !== '23505') {
			return fail(400, { message: 'Could not save that. Please try again.' });
		}
		return { message: 'Added.' };
	},

	removeDependency: async (event) => {
		const context = await projectContext(event);
		if (!context.canEdit) return fail(403, { message: VIEW_ONLY });
		const task = await loadTask(context, event.params.taskId);
		const dependsOn = text(await event.request.formData(), 'id');
		if (!isUuid(dependsOn)) return fail(400, { message: 'That link could not be found.' });
		await context.supabase
			.from('task_dependencies')
			.delete()
			.eq('task_id', task.id)
			.eq('depends_on_task_id', dependsOn);
		return { message: 'Removed.' };
	},

	comment: async (event) => {
		// Everyone in the workspace can comment, including people with view-only access.
		const context = await projectContext(event);
		const task = await loadTask(context, event.params.taskId);
		const body = text(await event.request.formData(), 'body');
		if (!body) return fail(400, { message: 'Write a comment first.' });
		if (body.length > 5000) return fail(400, { message: 'Keep comments to 5,000 characters or fewer.' });

		const name = displayName(context.profile);
		const { error: failure } = await context.supabase.from('task_comments').insert({
			task_id: task.id,
			author_user_id: context.profile.id,
			author_name: name,
			body
		});
		if (failure) {
			console.error('comment failed:', failure.message);
			return fail(400, { message: 'Could not post your comment. Please try again.' });
		}

		await notifyMany(context, [task.assignee_user_id, task.created_by], {
			kind: 'task_comment',
			title: `${name} commented on ${task.title}`,
			body,
			link: `/dashboard/projects/${context.project.id}/tasks/${task.id}`,
			projectId: context.project.id
		});
		return { message: 'Comment posted.' };
	},

	deleteComment: async (event) => {
		const context = await projectContext(event);
		const task = await loadTask(context, event.params.taskId);
		const id = text(await event.request.formData(), 'id');
		if (!isUuid(id)) return fail(400, { message: 'That comment could not be found.' });
		const { data } = await context.supabase
			.from('task_comments')
			.delete()
			.eq('id', id)
			.eq('task_id', task.id)
			.select('id')
			.maybeSingle();
		if (!data) return fail(403, { message: 'You can only delete your own comments.' });
		return { message: 'Comment deleted.' };
	}
};

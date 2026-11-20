import { projectContext } from '#lib/server/context.ts';
import { memberOptions, specOptions, workspaceMembers } from '#lib/server/lookups.ts';
import { moveTask, taskCrud } from '#lib/server/tasks.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const context = await projectContext(event);
	const { supabase, project } = context;

	const [tasks, members, specs] = await Promise.all([
		supabase
			.from('tasks')
			.select(
				'id, title, description, status, priority, assignee_user_id, assignee, due_date, labels, parent_task_id, spec_id, branch_name, sort_order, created_at'
			)
			.eq('project_id', project.id)
			.order('sort_order')
			.order('created_at', { ascending: false })
			.limit(2000),
		workspaceMembers(context),
		specOptions(context)
	]);

	const all = tasks.data ?? [];
	const ids = all.map((task) => task.id);
	const { data: dependencies } = ids.length
		? await supabase.from('task_dependencies').select('task_id, depends_on_task_id').in('task_id', ids)
		: { data: [] };

	const byId = new Map(all.map((task) => [task.id, task]));
	const blocked = new Set(
		(dependencies ?? [])
			.filter((dependency) => {
				const other = byId.get(dependency.depends_on_task_id);
				return other && other.status !== 'deployed';
			})
			.map((dependency) => dependency.task_id)
	);

	const subtasks = new Map<string, { total: number; done: number }>();
	for (const task of all) {
		if (!task.parent_task_id) continue;
		const entry = subtasks.get(task.parent_task_id) ?? { total: 0, done: 0 };
		entry.total += 1;
		if (task.status === 'deployed') entry.done += 1;
		subtasks.set(task.parent_task_id, entry);
	}

	const people = new Map(members.map((member) => [member.id, member]));

	return {
		tasks: all.map((task) => {
			const person = task.assignee_user_id ? people.get(task.assignee_user_id) : undefined;
			return {
				...task,
				assigneeName: person?.name ?? task.assignee ?? '',
				assigneeAvatar: person?.avatarUrl ?? null,
				parentTitle: task.parent_task_id ? (byId.get(task.parent_task_id)?.title ?? '') : '',
				subtasks: subtasks.get(task.id) ?? null,
				blocked: blocked.has(task.id)
			};
		}),
		members: memberOptions(members),
		specs,
		view: event.url.searchParams.get('view') === 'board' ? ('board' as const) : ('list' as const),
		openNew: event.url.searchParams.has('new')
	};
};

export const actions = { ...taskCrud, move: moveTask };

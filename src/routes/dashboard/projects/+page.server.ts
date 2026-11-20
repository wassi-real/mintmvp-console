import { fail, redirect } from '@sveltejs/kit';
import { projectFields } from '#lib/sections.ts';
import { displayName, workspaceContext } from '#lib/server/context.ts';
import { dbMessage, VIEW_ONLY } from '#lib/server/crud.ts';
import { validate } from '#lib/server/validate.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { supabase, profile } = workspaceContext(event);

	const { data: projects } = await supabase
		.from('projects')
		.select('id, name, description, status, priority, target_date, created_at')
		.eq('organization_id', profile.organization_id)
		.order('name');

	const ids = (projects ?? []).map((project) => project.id);
	const { data: tasks } = ids.length
		? await supabase.from('tasks').select('project_id, status').in('project_id', ids).limit(5000)
		: { data: [] };

	const counts = new Map<string, { open: number; done: number }>();
	for (const task of tasks ?? []) {
		const entry = counts.get(task.project_id) ?? { open: 0, done: 0 };
		if (task.status === 'deployed') entry.done += 1;
		else entry.open += 1;
		counts.set(task.project_id, entry);
	}

	return {
		list: (projects ?? []).map((project) => ({
			...project,
			openTasks: counts.get(project.id)?.open ?? 0,
			doneTasks: counts.get(project.id)?.done ?? 0
		})),
		openNew: event.url.searchParams.has('new')
	};
};

export const actions: Actions = {
	create: async (event) => {
		const context = workspaceContext(event);
		if (!context.canEdit) return fail(403, { message: VIEW_ONLY });

		const result = validate(projectFields, await event.request.formData());
		if (!result.ok) return fail(400, result);

		const { data: project, error } = await context.supabase
			.from('projects')
			.insert({
				...(result.values as { name: string }),
				organization_id: context.profile.organization_id
			})
			.select('id, name')
			.single();
		if (error) return fail(400, { message: dbMessage(error, 'project') });

		// Every project starts with a health record and the three usual environments.
		const setup = await Promise.all([
			context.supabase.from('project_health').insert({ project_id: project.id }),
			context.supabase.from('project_environments').insert(
				(['development', 'staging', 'production'] as const).map((kind) => ({
					project_id: project.id,
					kind,
					url: String(
						(kind === 'staging' ? result.values.staging_url : kind === 'production' ? result.values.production_url : '') ?? ''
					)
				}))
			),
			context.supabase.from('activity_log').insert({
				project_id: project.id,
				action: `Project created: ${project.name}`,
				actor: displayName(context.profile),
				metadata: { actor_id: context.profile.id }
			})
		]);
		for (const step of setup) {
			if (step.error) console.error('project setup step failed:', step.error.message);
		}

		redirect(303, `/dashboard/projects/${project.id}`);
	}
};

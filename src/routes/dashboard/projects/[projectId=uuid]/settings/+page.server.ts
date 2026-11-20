import { fail, redirect } from '@sveltejs/kit';
import { projectFields } from '#lib/sections.ts';
import { projectContext } from '#lib/server/context.ts';
import { dbMessage, VIEW_ONLY } from '#lib/server/crud.ts';
import { displayName } from '#lib/server/context.ts';
import { text, validate } from '#lib/server/validate.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	// Only the plain project row is returned. The context also holds the Supabase client, which
	// cannot be serialized into the page data.
	const { project } = await projectContext(event);
	return { project };
};

export const actions: Actions = {
	save: async (event) => {
		const context = await projectContext(event);
		if (!context.canEdit) return fail(403, { message: VIEW_ONLY });

		const result = validate(projectFields, await event.request.formData());
		if (!result.ok) return fail(400, result);

		const { error } = await context.supabase
			.from('projects')
			.update(result.values as { name: string })
			.eq('id', context.project.id);
		if (error) return fail(400, { message: dbMessage(error, 'project') });

		await context.supabase.from('activity_log').insert({
			project_id: context.project.id,
			action: `Project settings saved: ${String(result.values.name)}`,
			actor: displayName(context.profile),
			metadata: { actor_id: context.profile.id }
		});
		return { message: 'Project settings saved.' };
	},

	/**
	 * Deletes the project and, through the database, everything that belongs to it: tasks,
	 * milestones, reports, logs and the rest. This is the one destructive action in the app.
	 */
	delete: async (event) => {
		const context = await projectContext(event);
		if (!context.isOwner) return fail(403, { message: 'Only workspace owners can delete a project.' });

		const confirmation = text(await event.request.formData(), 'confirmation');
		if (confirmation !== context.project.name) {
			return fail(400, {
				message: 'Please fix the highlighted fields.',
				errors: { confirmation: 'Type the project name exactly to confirm.' }
			});
		}

		const { error } = await context.supabase.from('projects').delete().eq('id', context.project.id);
		if (error) return fail(400, { message: dbMessage(error, 'project') });
		redirect(303, '/dashboard/projects');
	}
};

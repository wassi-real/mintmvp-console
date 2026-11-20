import { MILESTONE_DONE_PHASES } from '#lib/constants.ts';
import { projectContext } from '#lib/server/context.ts';
import { crudActions } from '#lib/server/crud.ts';
import {
	memberOptions,
	milestoneFieldsFor,
	specOptions,
	workspaceMembers
} from '#lib/server/lookups.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const context = await projectContext(event);
	const { supabase, project } = context;

	const [milestones, members, specs] = await Promise.all([
		supabase
			.from('milestones')
			.select('id, title, description, phase, priority, due_date, owner_user_id, estimate, created_at')
			.eq('project_id', project.id)
			.order('due_date', { nullsFirst: false })
			.order('created_at'),
		workspaceMembers(context),
		specOptions(context)
	]);

	const all = milestones.data ?? [];
	const ids = all.map((milestone) => milestone.id);
	const { data: slices } = ids.length
		? await supabase.from('milestone_slices').select('milestone_id, status').in('milestone_id', ids)
		: { data: [] };

	const progress = new Map<string, { total: number; done: number }>();
	for (const slice of slices ?? []) {
		const entry = progress.get(slice.milestone_id) ?? { total: 0, done: 0 };
		entry.total += 1;
		if (slice.status === 'done') entry.done += 1;
		progress.set(slice.milestone_id, entry);
	}
	const people = new Map(members.map((member) => [member.id, member.name]));

	return {
		milestones: all.map((milestone) => ({
			...milestone,
			ownerName: milestone.owner_user_id ? (people.get(milestone.owner_user_id) ?? '') : '',
			steps: progress.get(milestone.id) ?? { total: 0, done: 0 },
			finished: MILESTONE_DONE_PHASES.has(milestone.phase)
		})),
		members: memberOptions(members),
		specs
	};
};

export const actions = crudActions({
	table: 'milestones',
	fields: milestoneFieldsFor,
	noun: 'milestone',
	titleField: 'title'
});
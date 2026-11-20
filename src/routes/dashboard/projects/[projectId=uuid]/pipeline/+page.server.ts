import { MILESTONE_DONE_PHASES, MILESTONE_PHASES } from '#lib/constants.ts';
import { projectContext } from '#lib/server/context.ts';
import type { PageServerLoad } from './$types';

const PHASE_ORDER = MILESTONE_PHASES.map((phase) => phase.value);
const FINISHED_LAST = PHASE_ORDER.length + 1;

export const load: PageServerLoad = async (event) => {
	const { supabase, project } = await projectContext(event);

	const { data: milestones } = await supabase
		.from('milestones')
		.select('id, title, phase, priority, due_date, owner_user_id')
		.eq('project_id', project.id)
		.order('due_date', { nullsFirst: false });

	const all = milestones ?? [];
	const ids = all.map((milestone) => milestone.id);
	const { data: slices } = ids.length
		? await supabase
				.from('milestone_slices')
				.select('milestone_id, status')
				.in('milestone_id', ids)
		: { data: [] };

	const progress = new Map<string, { total: number; done: number }>();
	for (const slice of slices ?? []) {
		const entry = progress.get(slice.milestone_id) ?? { total: 0, done: 0 };
		entry.total += 1;
		if (slice.status === 'done') entry.done += 1;
		progress.set(slice.milestone_id, entry);
	}

	const ordered = all
		.map((milestone) => ({
			...milestone,
			finished: MILESTONE_DONE_PHASES.has(milestone.phase),
			steps: progress.get(milestone.id) ?? { total: 0, done: 0 }
		}))
		.sort((a, b) => {
			const position = (item: typeof a) =>
				item.finished ? FINISHED_LAST : PHASE_ORDER.indexOf(item.phase);
			return position(a) - position(b) || (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999');
		});

	return {
		stages: MILESTONE_PHASES.map((phase) => ({
			...phase,
			milestones: ordered.filter((milestone) => milestone.phase === phase.value)
		})).filter((stage) => stage.milestones.length > 0),
		total: all.length,
		finished: all.filter((milestone) => MILESTONE_DONE_PHASES.has(milestone.phase)).length
	};
};

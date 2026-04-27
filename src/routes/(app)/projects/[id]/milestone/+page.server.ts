import type { Actions } from './$types';
import { deleteMilestone, updateMilestone } from '$lib/server/milestone-form-actions';

export const actions = {
	updateMilestone,
	deleteMilestone
} satisfies Actions;

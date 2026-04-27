import type { Actions } from './$types';
import { createMilestone } from '$lib/server/milestone-form-actions';

export const actions = {
	createMilestone
} satisfies Actions;

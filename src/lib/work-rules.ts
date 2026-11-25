// Timing rules for the work loop. Shown in the docs and used by the server.

import type { Field } from './fields.ts';

/** How long a claim lasts unless the agent renews it with a note or claims again. */
export const CLAIM_HOURS = 4;
export const MAX_CLAIM_HOURS = 24;
/** Open work nobody has claimed for this long moves to "Needs you". */
export const STALE_HOURS = 12;

export const CLAIMABLE_STATES = ['approved', 'in_progress', 'check_failed'] as const;
export const OPEN_STATES = ['idea', 'approved', 'in_progress', 'check_failed', 'qa_passed', 'accepted'] as const;

export type WorkStateId =
	| 'idea'
	| 'approved'
	| 'in_progress'
	| 'check_failed'
	| 'qa_passed'
	| 'accepted'
	| 'released'
	| 'dropped';

export function defaultNext(state: string): string {
	switch (state) {
		case 'idea':
			return 'A person approves or edits the plan.';
		case 'approved':
			return 'Claim it and start from the approved plan.';
		case 'in_progress':
			return 'Finish the work, then post a check with the build.';
		case 'check_failed':
			return 'Claim the fix, then post a new check.';
		case 'qa_passed':
			return 'A person accepts it.';
		case 'accepted':
			return 'Release it and record the version.';
		default:
			return '';
	}
}

const DEFAULT_NEXT = new Set(OPEN_STATES.map(defaultNext));

/** True when the text is one of the stock next actions, not something a person or agent wrote. */
export function isDefaultNext(text: string): boolean {
	return DEFAULT_NEXT.has(text);
}

export const PLAN_FIELDS: readonly Field[] = [
	{ name: 'title', label: 'Title', type: 'text', required: true, max: 200, wide: true, placeholder: 'Password reset by email' },
	{
		name: 'outcome',
		label: 'Outcome',
		type: 'textarea',
		max: 4000,
		rows: 3,
		hint: 'What is true when this is done, in plain words.'
	},
	{
		name: 'plan',
		label: 'Plan',
		type: 'textarea',
		max: 20000,
		rows: 8,
		hint: 'The steps your agent follows. Paste the plan your agent wrote, or let it create the work through the API.'
	},
	{
		name: 'acceptance',
		label: 'Acceptance criteria',
		type: 'textarea',
		max: 8000,
		rows: 4,
		hint: 'How a check decides pass or fail. One line each works well.'
	},
	{ name: 'base_version', label: 'Base version', type: 'text', max: 100, placeholder: 'v1.3.0 or a commit' }
];

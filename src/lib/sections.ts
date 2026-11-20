// Form definitions for every record type. Imported by pages (to draw the form) and by the server
// (to validate what was submitted), so the two can never disagree.

import {
	DEPLOYMENT_ENVIRONMENTS,
	DEPLOYMENT_STATUSES,
	ENVIRONMENT_KINDS,
	ENVIRONMENT_STATUSES,
	EXPENSE_CATEGORIES,
	INCIDENT_SEVERITIES,
	INCIDENT_STATUSES,
	MILESTONE_PAYMENT_STATUSES,
	MILESTONE_PHASES,
	MILESTONE_PRIORITIES,
	PAYMENT_METHODS,
	PRIORITIES,
	PROJECT_STATUSES,
	SLICE_STATUSES,
	SPEC_STATUSES,
	TASK_STATUSES,
	TEST_STATUSES,
	TEST_TYPES,
	type Option
} from './constants.ts';
import type { Field } from './fields.ts';

export const projectFields: readonly Field[] = [
	{ name: 'name', label: 'Project name', type: 'text', required: true, max: 120, wide: true },
	{
		name: 'description',
		label: 'Description',
		type: 'textarea',
		max: 2000,
		rows: 3,
		placeholder: 'What is this project and who is it for?'
	},
	{ name: 'status', label: 'Status', type: 'select', required: true, options: PROJECT_STATUSES, initial: 'active' },
	{ name: 'priority', label: 'Priority', type: 'select', required: true, options: PRIORITIES, initial: 'medium' },
	{ name: 'target_date', label: 'Target date', type: 'date' },
	{ name: 'repo_url', label: 'Code repository link', type: 'url', nullable: true, placeholder: 'https://github.com/…' },
	{ name: 'staging_url', label: 'Staging site link', type: 'url', nullable: true, placeholder: 'https://…' },
	{ name: 'production_url', label: 'Live site link', type: 'url', nullable: true, placeholder: 'https://…' }
];

/** Options that depend on the project: people, specs, other tasks and milestones. */
export interface Lookups {
	members?: readonly Option[];
	specs?: readonly Option[];
	tasks?: readonly Option[];
	milestones?: readonly Option[];
}

export function taskFields(lookups: Lookups = {}): readonly Field[] {
	return [
		{ name: 'title', label: 'Task', type: 'text', required: true, max: 200, wide: true },
		{ name: 'description', label: 'Details', type: 'textarea', nullable: true, max: 10000, rows: 4 },
		{ name: 'status', label: 'Status', type: 'select', required: true, options: TASK_STATUSES, initial: 'backlog' },
		{ name: 'priority', label: 'Priority', type: 'select', required: true, options: PRIORITIES, initial: 'medium' },
		{ name: 'assignee_user_id', label: 'Assigned to', type: 'select', nullable: true, options: lookups.members ?? [] },
		{ name: 'due_date', label: 'Due date', type: 'date' },
		{ name: 'parent_task_id', label: 'Part of (parent task)', type: 'select', nullable: true, options: lookups.tasks ?? [] },
		{ name: 'spec_id', label: 'Related spec', type: 'select', nullable: true, options: lookups.specs ?? [] },
		{ name: 'labels', label: 'Labels', type: 'tags', hint: 'Separate labels with commas.', placeholder: 'design, urgent' },
		{ name: 'branch_name', label: 'Code branch', type: 'text', nullable: true, max: 200, placeholder: 'feature/…' }
	];
}

export const specFields: readonly Field[] = [
	{ name: 'title', label: 'Title', type: 'text', required: true, max: 200 },
	{ name: 'status', label: 'Status', type: 'select', required: true, options: SPEC_STATUSES, initial: 'draft' },
	{ name: 'summary', label: 'Summary', type: 'textarea', nullable: true, rows: 3 },
	{ name: 'goal', label: 'Goal', type: 'textarea', nullable: true, rows: 3, hint: 'What should be true when this is finished?' },
	{ name: 'acceptance_criteria', label: 'How we know it is done', type: 'textarea', nullable: true, rows: 4 },
	{ name: 'edge_cases', label: 'Unusual situations to handle', type: 'textarea', nullable: true, rows: 3 },
	{ name: 'regression_risks', label: 'Things that could break', type: 'textarea', nullable: true, rows: 3 }
];

export function testFields(lookups: Lookups = {}): readonly Field[] {
	return [
		{ name: 'name', label: 'Test name', type: 'text', required: true, max: 200, wide: true },
		{ name: 'type', label: 'Type', type: 'select', required: true, options: TEST_TYPES, initial: 'manual' },
		{ name: 'status', label: 'Result', type: 'select', required: true, options: TEST_STATUSES, initial: 'pending' },
		{ name: 'spec_id', label: 'Related spec', type: 'select', nullable: true, options: lookups.specs ?? [] },
		{ name: 'task_id', label: 'Related task', type: 'select', nullable: true, options: lookups.tasks ?? [] },
		{ name: 'linked_commit', label: 'Code version (commit)', type: 'text', nullable: true, max: 100 },
		{ name: 'notes', label: 'Notes', type: 'textarea', nullable: true, rows: 3 }
	];
}

export const incidentFields: readonly Field[] = [
	{ name: 'title', label: 'What happened', type: 'text', required: true, max: 200, wide: true },
	{ name: 'severity', label: 'Severity', type: 'select', required: true, options: INCIDENT_SEVERITIES, initial: 'medium' },
	{ name: 'status', label: 'Status', type: 'select', required: true, options: INCIDENT_STATUSES, initial: 'open' },
	{ name: 'description', label: 'Details', type: 'textarea', nullable: true, rows: 5 }
];

export const deploymentFields: readonly Field[] = [
	{ name: 'version', label: 'Version', type: 'text', required: true, max: 100, placeholder: 'v1.4.0' },
	{ name: 'environment', label: 'Where', type: 'select', required: true, options: DEPLOYMENT_ENVIRONMENTS, initial: 'staging' },
	{ name: 'status', label: 'Result', type: 'select', required: true, options: DEPLOYMENT_STATUSES, initial: 'success' },
	{ name: 'notes', label: 'Notes', type: 'textarea', nullable: true, rows: 3 }
];

export const environmentFields: readonly Field[] = [
	{ name: 'kind', label: 'Environment', type: 'select', required: true, options: ENVIRONMENT_KINDS, initial: 'staging' },
	{ name: 'status', label: 'Status', type: 'select', required: true, options: ENVIRONMENT_STATUSES, initial: 'unknown' },
	{ name: 'url', label: 'Web address', type: 'url', placeholder: 'https://…' },
	{ name: 'current_version', label: 'Version running now', type: 'text', max: 100 }
];

export function milestoneFields(lookups: Lookups = {}): readonly Field[] {
	return [
		{ name: 'title', label: 'Milestone', type: 'text', required: true, max: 200, wide: true },
		{ name: 'phase', label: 'Stage', type: 'select', required: true, options: MILESTONE_PHASES, initial: 'planning' },
		{ name: 'priority', label: 'Priority', type: 'select', required: true, options: MILESTONE_PRIORITIES, initial: 'p3_normal' },
		{ name: 'due_date', label: 'Due date', type: 'date' },
		{ name: 'owner_user_id', label: 'Owner', type: 'select', nullable: true, options: lookups.members ?? [] },
		{ name: 'estimate', label: 'Estimate', type: 'text', max: 100, placeholder: '2 weeks' },
		{ name: 'spec_id', label: 'Related spec', type: 'select', nullable: true, options: lookups.specs ?? [] },
		{ name: 'description', label: 'Description', type: 'textarea', rows: 3 },
		{ name: 'deliverables', label: 'What will be delivered', type: 'textarea', rows: 3 },
		{ name: 'risks_blockers', label: 'Risks and blockers', type: 'textarea', rows: 2 },
		{ name: 'entry_gate', label: 'Needed before starting', type: 'textarea', rows: 2 },
		{ name: 'exit_gate', label: 'Needed before finishing', type: 'textarea', rows: 2 },
		{ name: 'notes', label: 'Notes', type: 'textarea', rows: 2 }
	];
}

export const milestoneBillingFields: readonly Field[] = [
	{ name: 'amount', label: 'Amount (USD)', type: 'money', required: true },
	{ name: 'status', label: 'Payment status', type: 'select', required: true, options: MILESTONE_PAYMENT_STATUSES, initial: 'planned' },
	{ name: 'paid_date', label: 'Date paid', type: 'date' }
];

export function sliceFields(lookups: Lookups = {}): readonly Field[] {
	return [
		{ name: 'title', label: 'Step', type: 'text', required: true, max: 200, wide: true },
		{ name: 'status', label: 'Status', type: 'select', required: true, options: SLICE_STATUSES, initial: 'pending' },
		{ name: 'owner_user_id', label: 'Owner', type: 'select', nullable: true, options: lookups.members ?? [] },
		{ name: 'start_date', label: 'Start date', type: 'date' },
		{ name: 'deadline', label: 'Deadline', type: 'date' },
		{ name: 'estimate', label: 'Estimate', type: 'text', max: 100 },
		{ name: 'notes', label: 'Notes', type: 'textarea', rows: 3 }
	];
}

export function paymentFields(lookups: Lookups = {}): readonly Field[] {
	return [
		{ name: 'amount', label: 'Amount (USD)', type: 'money', required: true, min: 0.01 },
		{ name: 'paid_at', label: 'Date received', type: 'date', required: true },
		{ name: 'payment_method', label: 'Paid with', type: 'select', options: PAYMENT_METHODS },
		{ name: 'milestone_id', label: 'For milestone', type: 'select', nullable: true, options: lookups.milestones ?? [] },
		{ name: 'notes', label: 'Notes', type: 'textarea', rows: 2 }
	];
}

export const expenseFields: readonly Field[] = [
	{ name: 'title', label: 'What was it for', type: 'text', required: true, max: 200, wide: true },
	{ name: 'amount', label: 'Amount (USD)', type: 'money', required: true, min: 0.01 },
	{ name: 'spent_at', label: 'Date', type: 'date', required: true },
	{ name: 'category', label: 'Category', type: 'select', options: EXPENSE_CATEGORIES },
	{ name: 'notes', label: 'Notes', type: 'textarea', rows: 2 }
];

export const monitoringTargetFields: readonly Field[] = [
	{ name: 'name', label: 'Name', type: 'text', required: true, max: 100, placeholder: 'Live website' },
	{ name: 'url', label: 'Web address to check', type: 'url', required: true, placeholder: 'https://…' },
	{ name: 'enabled', label: 'Include this address in checks', type: 'checkbox', initial: true }
];

export function reportFields(folders: readonly Option[] = []): readonly Field[] {
	return [
		{ name: 'title', label: 'Title', type: 'text', required: true, max: 300, wide: true },
		{ name: 'folder_id', label: 'Folder', type: 'select', nullable: true, options: folders, wide: true },
		{
			name: 'content',
			label: 'Content',
			type: 'textarea',
			required: true,
			max: 400000,
			rows: 16,
			hint: 'You can use Markdown: # headings, **bold**, lists and tables.'
		}
	];
}

export const reportFolderFields: readonly Field[] = [
	{ name: 'name', label: 'Folder name', type: 'text', required: true, max: 80, wide: true }
];

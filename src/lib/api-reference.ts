// Public description of the project API. The server enforces this same list.
// Safe to import from pages: it has no secrets and no database access.

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
	TEST_TYPES
} from './constants.ts';

export type FieldKind = 'string' | 'text' | 'date' | 'enum' | 'uuid' | 'number' | 'boolean' | 'tags' | 'url';

export interface ApiField {
	name: string;
	kind: FieldKind;
	required?: boolean;
	nullable?: boolean;
	max?: number;
	min?: number;
	options?: readonly string[];
}

export interface ApiResource {
	slug: string;
	title: string;
	summary: string;
	/** Verbs allowed on the collection. Project is a single record, so PATCH updates that record. */
	methods: readonly ('GET' | 'POST' | 'PATCH' | 'DELETE')[];
	fields: readonly ApiField[];
	filters?: readonly string[];
	/** Free and Premium caps per project per calendar month. Premium 0 means no cap. */
	monthly?: { free: number; premium: number };
	/** Omitted from list responses. Still returned when you fetch one record. */
	listOmits?: readonly string[];
	example?: Record<string, unknown>;
}

const values = (options: readonly { value: string }[]) => options.map((option) => option.value);

export const API_RESOURCES: readonly ApiResource[] = [
	{
		slug: 'project',
		title: 'Project',
		summary: 'The project this key belongs to. A key cannot see or change any other project.',
		methods: ['GET', 'PATCH'],
		fields: [
			{ name: 'name', kind: 'string', required: true, max: 120 },
			{ name: 'description', kind: 'text', max: 2000 },
			{ name: 'status', kind: 'enum', required: true, options: values(PROJECT_STATUSES) },
			{ name: 'priority', kind: 'enum', required: true, options: values(PRIORITIES) },
			{ name: 'target_date', kind: 'date', nullable: true },
			{ name: 'repo_url', kind: 'url', nullable: true },
			{ name: 'staging_url', kind: 'url', nullable: true },
			{ name: 'production_url', kind: 'url', nullable: true }
		],
		example: { description: 'Updated from the API.' }
	},
	{
		slug: 'tasks',
		title: 'Tasks',
		summary: 'Work items on the project, including status, assignee and labels.',
		methods: ['GET', 'POST', 'PATCH', 'DELETE'],
		filters: ['status', 'priority'],
		monthly: { free: 30, premium: 0 },
		fields: [
			{ name: 'title', kind: 'string', required: true, max: 200 },
			{ name: 'description', kind: 'text', nullable: true, max: 10000 },
			{ name: 'status', kind: 'enum', options: values(TASK_STATUSES) },
			{ name: 'priority', kind: 'enum', options: values(PRIORITIES) },
			{ name: 'assignee_user_id', kind: 'uuid', nullable: true },
			{ name: 'due_date', kind: 'date', nullable: true },
			{ name: 'parent_task_id', kind: 'uuid', nullable: true },
			{ name: 'spec_id', kind: 'uuid', nullable: true },
			{ name: 'labels', kind: 'tags' },
			{ name: 'branch_name', kind: 'string', nullable: true, max: 200 }
		],
		example: { title: 'Ship the billing page', status: 'backlog', priority: 'high' }
	},
	{
		slug: 'milestones',
		title: 'Milestones',
		summary: 'Delivery milestones, including stage, owner and payment status.',
		methods: ['GET', 'POST', 'PATCH', 'DELETE'],
		filters: ['phase', 'priority', 'status'],
		monthly: { free: 3, premium: 0 },
		fields: [
			{ name: 'title', kind: 'string', required: true, max: 200 },
			{ name: 'phase', kind: 'enum', options: values(MILESTONE_PHASES) },
			{ name: 'priority', kind: 'enum', options: values(MILESTONE_PRIORITIES) },
			{ name: 'due_date', kind: 'date', nullable: true },
			{ name: 'owner_user_id', kind: 'uuid', nullable: true },
			{ name: 'estimate', kind: 'string', max: 100 },
			{ name: 'spec_id', kind: 'uuid', nullable: true },
			{ name: 'description', kind: 'text', max: 8000 },
			{ name: 'deliverables', kind: 'text', max: 8000 },
			{ name: 'risks_blockers', kind: 'text', max: 8000 },
			{ name: 'entry_gate', kind: 'text', max: 4000 },
			{ name: 'exit_gate', kind: 'text', max: 4000 },
			{ name: 'notes', kind: 'text', max: 8000 },
			{ name: 'amount', kind: 'number', min: 0 },
			{ name: 'status', kind: 'enum', options: values(MILESTONE_PAYMENT_STATUSES) },
			{ name: 'paid_date', kind: 'date', nullable: true }
		],
		example: { title: 'Public beta', phase: 'planning', priority: 'p3_normal' }
	},
	{
		slug: 'specs',
		title: 'Specs',
		summary: 'Written specs: goal, acceptance criteria and risks.',
		methods: ['GET', 'POST', 'PATCH', 'DELETE'],
		filters: ['status'],
		monthly: { free: 3, premium: 20 },
		fields: [
			{ name: 'title', kind: 'string', required: true, max: 200 },
			{ name: 'status', kind: 'enum', options: values(SPEC_STATUSES) },
			{ name: 'summary', kind: 'text', nullable: true, max: 8000 },
			{ name: 'goal', kind: 'text', nullable: true, max: 8000 },
			{ name: 'acceptance_criteria', kind: 'text', nullable: true, max: 16000 },
			{ name: 'edge_cases', kind: 'text', nullable: true, max: 8000 },
			{ name: 'regression_risks', kind: 'text', nullable: true, max: 8000 }
		],
		example: { title: 'Invite flow', status: 'draft', goal: 'Owners can invite by email.' }
	},
	{
		slug: 'reports',
		title: 'Reports',
		summary: 'Markdown reports. List responses omit content. Fetch one report to read it.',
		methods: ['GET', 'POST', 'PATCH', 'DELETE'],
		filters: ['folder_id'],
		monthly: { free: 5, premium: 40 },
		listOmits: ['content'],
		fields: [
			{ name: 'title', kind: 'string', required: true, max: 300 },
			{ name: 'content', kind: 'text', required: true, max: 400000 },
			{ name: 'folder_id', kind: 'uuid', nullable: true }
		],
		example: { title: 'Week 12', content: '## Done\n\n- Shipped invites' }
	},
	{
		slug: 'report-folders',
		title: 'Report folders',
		summary: 'Folders that group reports.',
		methods: ['GET', 'POST', 'PATCH', 'DELETE'],
		fields: [
			{ name: 'name', kind: 'string', required: true, max: 80 },
			{ name: 'icon', kind: 'string', max: 40 }
		],
		example: { name: 'Weekly' }
	},
	{
		slug: 'tests',
		title: 'Tests',
		summary: 'Test cases and their latest result.',
		methods: ['GET', 'POST', 'PATCH', 'DELETE'],
		filters: ['status', 'type'],
		fields: [
			{ name: 'name', kind: 'string', required: true, max: 200 },
			{ name: 'type', kind: 'enum', options: values(TEST_TYPES) },
			{ name: 'status', kind: 'enum', options: values(TEST_STATUSES) },
			{ name: 'spec_id', kind: 'uuid', nullable: true },
			{ name: 'task_id', kind: 'uuid', nullable: true },
			{ name: 'linked_commit', kind: 'string', nullable: true, max: 100 },
			{ name: 'notes', kind: 'text', nullable: true, max: 8000 }
		],
		example: { name: 'Invite accepts a known user', type: 'manual', status: 'pending' }
	},
	{
		slug: 'incidents',
		title: 'Incidents',
		summary: 'Production incidents and their severity.',
		methods: ['GET', 'POST', 'PATCH', 'DELETE'],
		filters: ['status', 'severity'],
		monthly: { free: 5, premium: 0 },
		fields: [
			{ name: 'title', kind: 'string', required: true, max: 200 },
			{ name: 'severity', kind: 'enum', options: values(INCIDENT_SEVERITIES) },
			{ name: 'status', kind: 'enum', options: values(INCIDENT_STATUSES) },
			{ name: 'description', kind: 'text', nullable: true, max: 16000 }
		],
		example: { title: 'Login timeout', severity: 'high', status: 'open' }
	},
	{
		slug: 'deployments',
		title: 'Deployments',
		summary: 'Deployment records you log for staging and production.',
		methods: ['GET', 'POST', 'PATCH', 'DELETE'],
		filters: ['environment', 'status'],
		fields: [
			{ name: 'version', kind: 'string', required: true, max: 100 },
			{ name: 'environment', kind: 'enum', options: values(DEPLOYMENT_ENVIRONMENTS) },
			{ name: 'status', kind: 'enum', options: values(DEPLOYMENT_STATUSES) },
			{ name: 'notes', kind: 'text', nullable: true, max: 8000 }
		],
		example: { version: 'v1.4.0', environment: 'staging', status: 'success' }
	},
	{
		slug: 'environments',
		title: 'Environments',
		summary: 'Development, staging and production environment status.',
		methods: ['GET', 'POST', 'PATCH', 'DELETE'],
		filters: ['kind', 'status'],
		fields: [
			{ name: 'kind', kind: 'enum', required: true, options: values(ENVIRONMENT_KINDS) },
			{ name: 'status', kind: 'enum', options: values(ENVIRONMENT_STATUSES) },
			{ name: 'url', kind: 'url' },
			{ name: 'current_version', kind: 'string', max: 100 }
		],
		example: { kind: 'staging', status: 'healthy', url: 'https://staging.example.com' }
	},
	{
		slug: 'payments',
		title: 'Payments',
		summary: 'Money received for this project.',
		methods: ['GET', 'POST', 'PATCH', 'DELETE'],
		fields: [
			{ name: 'amount', kind: 'number', required: true, min: 0.01 },
			{ name: 'paid_at', kind: 'date', required: true },
			{ name: 'payment_method', kind: 'enum', options: values(PAYMENT_METHODS) },
			{ name: 'milestone_id', kind: 'uuid', nullable: true },
			{ name: 'notes', kind: 'text', max: 4000 }
		],
		example: { amount: 1500, paid_at: '2026-11-01', payment_method: 'wise' }
	},
	{
		slug: 'expenses',
		title: 'Expenses',
		summary: 'Money spent on this project.',
		methods: ['GET', 'POST', 'PATCH', 'DELETE'],
		fields: [
			{ name: 'title', kind: 'string', required: true, max: 200 },
			{ name: 'amount', kind: 'number', required: true, min: 0.01 },
			{ name: 'spent_at', kind: 'date', required: true },
			{ name: 'category', kind: 'enum', options: values(EXPENSE_CATEGORIES) },
			{ name: 'notes', kind: 'text', max: 4000 }
		],
		example: { title: 'Hosting', amount: 20, spent_at: '2026-11-01', category: 'hosting' }
	},
	{
		slug: 'monitoring-targets',
		title: 'Monitoring',
		summary: 'URLs the console checks. Fetching one target also returns its recent checks.',
		methods: ['GET', 'POST', 'PATCH', 'DELETE'],
		fields: [
			{ name: 'name', kind: 'string', required: true, max: 100 },
			{ name: 'url', kind: 'url', required: true },
			{ name: 'enabled', kind: 'boolean' }
		],
		example: { name: 'Live website', url: 'https://example.com', enabled: true }
	},
	{
		slug: 'activity',
		title: 'Activity',
		summary: 'The project activity log. Read only. Writes from this API are recorded here.',
		methods: ['GET'],
		fields: []
	},
	{
		slug: 'github-commits',
		title: 'GitHub commits',
		summary: 'Commits synced from the connected repository. Read only.',
		methods: ['GET'],
		fields: []
	},
	{
		slug: 'github-pull-requests',
		title: 'GitHub pull requests',
		summary: 'Pull requests synced from GitHub. Read only.',
		methods: ['GET'],
		filters: ['status'],
		fields: []
	},
	{
		slug: 'github-branches',
		title: 'GitHub branches',
		summary: 'Branches synced from GitHub. Read only.',
		methods: ['GET'],
		fields: []
	},
	{
		slug: 'github-builds',
		title: 'GitHub builds',
		summary: 'CI runs synced from GitHub. Read only.',
		methods: ['GET'],
		filters: ['status'],
		fields: []
	},
	{
		slug: 'github-deployments',
		title: 'GitHub deployments',
		summary: 'Deployments synced from GitHub. Read only.',
		methods: ['GET'],
		filters: ['environment', 'status'],
		fields: []
	}
];

export function resourceBySlug(slug: string): ApiResource | undefined {
	return API_RESOURCES.find((resource) => resource.slug === slug);
}

export const SLICE_FIELDS: readonly ApiField[] = [
	{ name: 'title', kind: 'string', required: true, max: 200 },
	{ name: 'status', kind: 'enum', options: values(SLICE_STATUSES) },
	{ name: 'owner_user_id', kind: 'uuid', nullable: true },
	{ name: 'start_date', kind: 'date', nullable: true },
	{ name: 'deadline', kind: 'date', nullable: true },
	{ name: 'estimate', kind: 'string', max: 100 },
	{ name: 'notes', kind: 'text', max: 8000 }
];

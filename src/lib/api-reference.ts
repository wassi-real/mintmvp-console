// Public description of the project API. The server enforces this same list.
// Safe to import from pages: it has no secrets and no database access.

import { PRIORITIES, PROJECT_STATUSES, TASK_STATUSES } from './constants.ts';

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
	/** Free and Mint caps per project per calendar month. A Mint cap of 0 means no cap. */
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
	}
];

export function resourceBySlug(slug: string): ApiResource | undefined {
	return API_RESOURCES.find((resource) => resource.slug === slug);
}

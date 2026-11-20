// Labels and allowed values for every status-like column. The values match the CHECK constraints
// in the database; the labels are what people see.

export type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info';

export interface Option {
	value: string;
	label: string;
	tone?: Tone;
}

function lookup(options: readonly Option[]) {
	const map = new Map(options.map((option) => [option.value, option]));
	return (value: string | null | undefined): Option =>
		map.get(value ?? '') ?? { value: value ?? '', label: humanize(value ?? ''), tone: 'neutral' };
}

export function humanize(value: string): string {
	const text = value.replace(/^"|"$/g, '').replace(/[_-]+/g, ' ').trim();
	return text ? text.charAt(0).toUpperCase() + text.slice(1) : 'None';
}

export const ROLES: readonly Option[] = [
	{ value: 'owner', label: 'Owner' },
	{ value: 'developer', label: 'Developer' },
	{ value: 'client', label: 'Client (view only)' }
];
export const INVITE_ROLES = ROLES.filter((role) => role.value !== 'owner');

export const PROJECT_STATUSES: readonly Option[] = [
	{ value: 'active', label: 'Active', tone: 'ok' },
	{ value: 'maintenance', label: 'Maintenance', tone: 'info' },
	{ value: 'paused', label: 'Paused', tone: 'warn' },
	{ value: 'completed', label: 'Completed', tone: 'neutral' },
	{ value: 'archived', label: 'Archived', tone: 'neutral' }
];

export const PRIORITIES: readonly Option[] = [
	{ value: 'high', label: 'High', tone: 'bad' },
	{ value: 'medium', label: 'Medium', tone: 'warn' },
	{ value: 'low', label: 'Low', tone: 'neutral' }
];

export const TASK_STATUSES: readonly Option[] = [
	{ value: 'backlog', label: 'To do', tone: 'neutral' },
	{ value: 'in_progress', label: 'In progress', tone: 'info' },
	{ value: 'review', label: 'In review', tone: 'warn' },
	{ value: 'testing', label: 'Testing', tone: 'warn' },
	{ value: 'deployed', label: 'Done', tone: 'ok' }
];

export const SPEC_STATUSES: readonly Option[] = [
	{ value: 'draft', label: 'Draft', tone: 'neutral' },
	{ value: 'approved', label: 'Approved', tone: 'info' },
	{ value: 'in_dev', label: 'In development', tone: 'warn' },
	{ value: 'completed', label: 'Completed', tone: 'ok' }
];

export const TEST_TYPES: readonly Option[] = [
	{ value: 'unit', label: 'Unit' },
	{ value: 'integration', label: 'Integration' },
	{ value: 'e2e', label: 'End to end' },
	{ value: 'smoke', label: 'Smoke' },
	{ value: 'manual', label: 'Manual' }
];

export const TEST_STATUSES: readonly Option[] = [
	{ value: 'pending', label: 'Not run', tone: 'neutral' },
	{ value: 'pass', label: 'Passing', tone: 'ok' },
	{ value: 'fail', label: 'Failing', tone: 'bad' }
];

export const INCIDENT_SEVERITIES: readonly Option[] = [
	{ value: 'critical', label: 'Critical', tone: 'bad' },
	{ value: 'high', label: 'High', tone: 'bad' },
	{ value: 'medium', label: 'Medium', tone: 'warn' },
	{ value: 'low', label: 'Low', tone: 'neutral' }
];

export const INCIDENT_STATUSES: readonly Option[] = [
	{ value: 'open', label: 'Open', tone: 'bad' },
	{ value: 'investigating', label: 'Investigating', tone: 'warn' },
	{ value: 'resolved', label: 'Resolved', tone: 'ok' }
];

export const ENVIRONMENT_KINDS: readonly Option[] = [
	{ value: 'development', label: 'Development' },
	{ value: 'staging', label: 'Staging' },
	{ value: 'production', label: 'Production' }
];

export const ENVIRONMENT_STATUSES: readonly Option[] = [
	{ value: 'healthy', label: 'Healthy', tone: 'ok' },
	{ value: 'broken', label: 'Broken', tone: 'bad' },
	{ value: 'unknown', label: 'Not checked', tone: 'neutral' }
];

export const DEPLOYMENT_ENVIRONMENTS: readonly Option[] = [
	{ value: 'staging', label: 'Staging' },
	{ value: 'production', label: 'Production' }
];

export const DEPLOYMENT_STATUSES: readonly Option[] = [
	{ value: 'pending', label: 'In progress', tone: 'warn' },
	{ value: 'success', label: 'Succeeded', tone: 'ok' },
	{ value: 'failed', label: 'Failed', tone: 'bad' }
];

export const CI_STATUSES: readonly Option[] = [
	{ value: 'pending', label: 'Queued', tone: 'neutral' },
	{ value: 'in_progress', label: 'Running', tone: 'warn' },
	{ value: 'success', label: 'Passed', tone: 'ok' },
	{ value: 'failure', label: 'Failed', tone: 'bad' },
	{ value: 'cancelled', label: 'Cancelled', tone: 'neutral' }
];

export const GH_DEPLOYMENT_STATUSES: readonly Option[] = [
	{ value: 'pending', label: 'In progress', tone: 'warn' },
	{ value: 'success', label: 'Succeeded', tone: 'ok' },
	{ value: 'failure', label: 'Failed', tone: 'bad' },
	{ value: 'inactive', label: 'Replaced', tone: 'neutral' }
];

export const PR_STATUSES: readonly Option[] = [
	{ value: 'open', label: 'Open', tone: 'info' },
	{ value: 'merged', label: 'Merged', tone: 'ok' },
	{ value: 'closed', label: 'Closed', tone: 'neutral' }
];

export const BRANCH_STATUSES: readonly Option[] = [
	{ value: 'active', label: 'Active', tone: 'ok' },
	{ value: 'stale', label: 'Stale', tone: 'neutral' }
];

export const COMMIT_STATUSES: readonly Option[] = [
	{ value: 'draft', label: 'Draft', tone: 'neutral' },
	{ value: 'in_review', label: 'In review', tone: 'warn' },
	{ value: 'merged', label: 'Merged', tone: 'ok' }
];

export const MILESTONE_PHASES: readonly Option[] = [
	{ value: 'discovery', label: 'Discovery', tone: 'neutral' },
	{ value: 'planning', label: 'Planning', tone: 'neutral' },
	{ value: 'execution', label: 'In progress', tone: 'info' },
	{ value: 'internal_testing', label: 'Internal testing', tone: 'warn' },
	{ value: 'client_review', label: 'Client review', tone: 'warn' },
	{ value: 'approved', label: 'Approved', tone: 'ok' },
	{ value: 'released', label: 'Released', tone: 'ok' },
	{ value: 'blocked', label: 'Blocked', tone: 'bad' },
	{ value: 'closed', label: 'Closed', tone: 'neutral' }
];

/** Phases that count as finished when working out progress. */
export const MILESTONE_DONE_PHASES = new Set(['approved', 'released', 'closed']);

export const MILESTONE_PRIORITIES: readonly Option[] = [
	{ value: 'p1_critical', label: 'Critical', tone: 'bad' },
	{ value: 'p2_high', label: 'High', tone: 'warn' },
	{ value: 'p3_normal', label: 'Normal', tone: 'neutral' },
	{ value: 'p4_low', label: 'Low', tone: 'neutral' }
];

/** milestones.status is the payment state of a milestone. */
export const MILESTONE_PAYMENT_STATUSES: readonly Option[] = [
	{ value: 'planned', label: 'Not billed', tone: 'neutral' },
	{ value: 'active', label: 'In progress', tone: 'info' },
	{ value: 'ready_for_payment', label: 'Ready for payment', tone: 'warn' },
	{ value: 'paid', label: 'Paid', tone: 'ok' },
	{ value: 'overdue', label: 'Overdue', tone: 'bad' }
];

export const SLICE_STATUSES: readonly Option[] = [
	{ value: 'pending', label: 'To do', tone: 'neutral' },
	{ value: 'in_progress', label: 'In progress', tone: 'info' },
	{ value: 'done', label: 'Done', tone: 'ok' },
	{ value: 'blocked', label: 'Blocked', tone: 'bad' }
];

export const PAYMENT_METHODS: readonly Option[] = [
	{ value: '', label: 'Not specified' },
	{ value: 'wise', label: 'Wise' },
	{ value: 'bank_transfer', label: 'Bank transfer' },
	{ value: 'paypal', label: 'PayPal' },
	{ value: 'stripe', label: 'Stripe' },
	{ value: 'cash', label: 'Cash' },
	{ value: 'other', label: 'Other' }
];

export const EXPENSE_CATEGORIES: readonly Option[] = [
	{ value: '', label: 'Uncategorised' },
	{ value: 'developer', label: 'Developer' },
	{ value: 'hosting', label: 'Hosting' },
	{ value: 'domain', label: 'Domain' },
	{ value: 'api_credits', label: 'API credits' },
	{ value: 'design', label: 'Design' },
	{ value: 'marketing', label: 'Marketing' },
	{ value: 'other', label: 'Other' }
];

export const UPTIME_STATUSES: readonly Option[] = [
	{ value: 'up', label: 'Up', tone: 'ok' },
	{ value: 'degraded', label: 'Degraded', tone: 'warn' },
	{ value: 'down', label: 'Down', tone: 'bad' },
	{ value: 'unknown', label: 'Not checked', tone: 'neutral' }
];

export const LOG_SEVERITIES: readonly Option[] = [
	{ value: 'error', label: 'Error', tone: 'bad' },
	{ value: 'warn', label: 'Warning', tone: 'warn' },
	{ value: 'info', label: 'Info', tone: 'neutral' }
];

export const projectStatus = lookup(PROJECT_STATUSES);
export const priority = lookup(PRIORITIES);
export const taskStatus = lookup(TASK_STATUSES);
export const specStatus = lookup(SPEC_STATUSES);
export const testType = lookup(TEST_TYPES);
export const testStatus = lookup(TEST_STATUSES);
export const incidentSeverity = lookup(INCIDENT_SEVERITIES);
export const incidentStatus = lookup(INCIDENT_STATUSES);
export const environmentKind = lookup(ENVIRONMENT_KINDS);
export const environmentStatus = lookup(ENVIRONMENT_STATUSES);
export const deploymentStatus = lookup(DEPLOYMENT_STATUSES);
export const ciStatus = lookup(CI_STATUSES);
export const ghDeploymentStatus = lookup(GH_DEPLOYMENT_STATUSES);
export const prStatus = lookup(PR_STATUSES);
export const branchStatus = lookup(BRANCH_STATUSES);
export const commitStatus = lookup(COMMIT_STATUSES);
export const milestonePhase = lookup(MILESTONE_PHASES);
export const milestonePriority = lookup(MILESTONE_PRIORITIES);
export const milestonePaymentStatus = lookup(MILESTONE_PAYMENT_STATUSES);
export const sliceStatus = lookup(SLICE_STATUSES);
export const paymentMethod = lookup(PAYMENT_METHODS);
export const expenseCategory = lookup(EXPENSE_CATEGORIES);
export const uptimeStatus = lookup(UPTIME_STATUSES);
export const logSeverity = lookup(LOG_SEVERITIES);
export const role = lookup(ROLES);

// ─── Onboarding questions ────────────────────────────────────────────────────

export const PERSONAS: readonly Option[] = [
	{ value: 'founder', label: 'Founder or business owner' },
	{ value: 'developer', label: 'Developer or engineer' },
	{ value: 'project_manager', label: 'Project or product manager' },
	{ value: 'agency', label: 'Agency or freelancer' },
	{ value: 'client', label: 'Client following a project' },
	{ value: 'student', label: 'Student or hobbyist' },
	{ value: 'other', label: 'Something else' }
];

export const USE_CASES: readonly Option[] = [
	{ value: 'client_projects', label: 'Manage projects for clients' },
	{ value: 'own_product', label: 'Build my own product' },
	{ value: 'team_tasks', label: 'Organise tasks for a team' },
	{ value: 'engineering', label: 'Track code, tests and deployments' },
	{ value: 'finance', label: 'Track payments and costs' },
	{ value: 'follow_project', label: 'Follow a project I was invited to' },
	{ value: 'exploring', label: 'Just looking around' }
];

export const REFERRAL_SOURCES: readonly Option[] = [
	{ value: 'search', label: 'Google or another search engine' },
	{ value: 'social', label: 'X, LinkedIn or other social media' },
	{ value: 'youtube', label: 'YouTube' },
	{ value: 'github', label: 'GitHub' },
	{ value: 'friend', label: 'A friend or colleague' },
	{ value: 'mintmvp', label: 'I work with MintMVP' },
	{ value: 'other', label: 'Somewhere else' }
];

export const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;
export const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const PASSWORD_MIN = 8;

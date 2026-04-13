/**
 * Normalize / validate enum-like fields before writes so Postgres CHECK constraints
 * don't reject common API/AI payloads (e.g. in_progress vs in_dev for specs).
 */

function normKey(raw: string): string {
	return raw
		.trim()
		.toLowerCase()
		.replace(/[\s-]+/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_|_$/g, '');
}

type ParseResult =
	| { ok: true; value: string }
	| { ok: false; error: string };

function parseEnum(
	raw: unknown,
	allowed: readonly string[],
	aliases: Record<string, string>,
	fieldLabel: string
): ParseResult {
	if (raw === undefined) return { ok: false, error: `${fieldLabel} is missing` };
	if (raw === null) return { ok: false, error: `${fieldLabel} cannot be null` };
	if (typeof raw !== 'string') {
		return { ok: false, error: `${fieldLabel} must be a string` };
	}
	const k = normKey(raw);
	if (!k) return { ok: false, error: `${fieldLabel} cannot be empty` };
	if (aliases[k]) return { ok: true, value: aliases[k] };
	if (allowed.includes(k)) return { ok: true, value: k };
	return {
		ok: false,
		error: `Invalid ${fieldLabel} "${raw}". Allowed: ${allowed.join(', ')}`
	};
}

const SPEC_ALLOWED = ['draft', 'approved', 'in_dev', 'completed'] as const;
const SPEC_ALIASES: Record<string, string> = {
	in_progress: 'in_dev',
	inprogress: 'in_dev',
	development: 'in_dev',
	in_development: 'in_dev',
	dev: 'in_dev',
	building: 'in_dev',
	implementation: 'in_dev',
	done: 'completed',
	complete: 'completed',
	finished: 'completed',
	shipped: 'completed',
	closed: 'completed',
	ready: 'approved',
	reviewed: 'approved',
	signed_off: 'approved'
};

export function normalizeSpecStatus(raw: unknown): ParseResult {
	return parseEnum(raw, SPEC_ALLOWED, SPEC_ALIASES, 'spec status');
}

const TASK_STATUS_ALLOWED = ['backlog', 'in_progress', 'review', 'testing', 'deployed'] as const;
const TASK_STATUS_ALIASES: Record<string, string> = {
	todo: 'backlog',
	open: 'backlog',
	planned: 'backlog',
	inprogress: 'in_progress',
	active: 'in_progress',
	doing: 'in_progress',
	in_review: 'review',
	'pr': 'review',
	pull_request: 'review',
	qa: 'testing',
	test: 'testing',
	verification: 'testing',
	done: 'deployed',
	complete: 'deployed',
	finished: 'deployed',
	shipped: 'deployed',
	live: 'deployed'
};

export function normalizeTaskStatus(raw: unknown): ParseResult {
	return parseEnum(raw, TASK_STATUS_ALLOWED, TASK_STATUS_ALIASES, 'task status');
}

const TASK_PRIORITY_ALLOWED = ['low', 'medium', 'high'] as const;
const TASK_PRIORITY_ALIASES: Record<string, string> = {
	normal: 'medium',
	med: 'medium',
	mid: 'medium',
	p1: 'high',
	p2: 'medium',
	p3: 'low',
	critical: 'high',
	urgent: 'high'
};

export function normalizeTaskPriority(raw: unknown): ParseResult {
	return parseEnum(raw, TASK_PRIORITY_ALLOWED, TASK_PRIORITY_ALIASES, 'task priority');
}

const TEST_TYPE_ALLOWED = ['unit', 'integration', 'e2e', 'smoke', 'manual'] as const;
const TEST_TYPE_ALIASES: Record<string, string> = {
	end_to_end: 'e2e',
	system: 'integration',
	ui: 'manual',
	exploratory: 'manual',
	regression: 'integration'
};

export function normalizeTestType(raw: unknown): ParseResult {
	return parseEnum(raw, TEST_TYPE_ALLOWED, TEST_TYPE_ALIASES, 'test type');
}

const TEST_STATUS_ALLOWED = ['pass', 'fail', 'pending'] as const;
const TEST_STATUS_ALIASES: Record<string, string> = {
	passed: 'pass',
	passing: 'pass',
	ok: 'pass',
	success: 'pass',
	green: 'pass',
	failed: 'fail',
	failing: 'fail',
	error: 'fail',
	red: 'fail',
	queued: 'pending',
	running: 'pending',
	skipped: 'pending',
	unknown: 'pending'
};

export function normalizeTestStatus(raw: unknown): ParseResult {
	return parseEnum(raw, TEST_STATUS_ALLOWED, TEST_STATUS_ALIASES, 'test status');
}

const INCIDENT_SEVERITY_ALLOWED = ['low', 'medium', 'high', 'critical'] as const;
const INCIDENT_SEVERITY_ALIASES: Record<string, string> = {
	sev0: 'critical',
	sev1: 'high',
	sev2: 'medium',
	sev3: 'low',
	sev_0: 'critical',
	sev_1: 'high',
	sev_2: 'medium',
	sev_3: 'low',
	p0: 'critical',
	p1: 'high',
	p2: 'medium',
	p3: 'low',
	major: 'high',
	minor: 'low'
};

export function normalizeIncidentSeverity(raw: unknown): ParseResult {
	return parseEnum(raw, INCIDENT_SEVERITY_ALLOWED, INCIDENT_SEVERITY_ALIASES, 'incident severity');
}

const INCIDENT_STATUS_ALLOWED = ['open', 'investigating', 'resolved'] as const;
const INCIDENT_STATUS_ALIASES: Record<string, string> = {
	new: 'open',
	active: 'open',
	triaged: 'investigating',
	in_progress: 'investigating',
	investigation: 'investigating',
	mitigating: 'investigating',
	fixed: 'resolved',
	closed: 'resolved',
	done: 'resolved',
	complete: 'resolved'
};

export function normalizeIncidentStatus(raw: unknown): ParseResult {
	return parseEnum(raw, INCIDENT_STATUS_ALLOWED, INCIDENT_STATUS_ALIASES, 'incident status');
}

const DEPLOY_ENV_ALLOWED = ['staging', 'production'] as const;
const DEPLOY_ENV_ALIASES: Record<string, string> = {
	prod: 'production',
	staging_: 'staging',
	stg: 'staging',
	preprod: 'staging',
	preview: 'staging'
};

export function normalizeDeploymentEnvironment(raw: unknown): ParseResult {
	return parseEnum(raw, DEPLOY_ENV_ALLOWED, DEPLOY_ENV_ALIASES, 'deployment environment');
}

const DEPLOY_STATUS_ALLOWED = ['success', 'failed', 'pending'] as const;
const DEPLOY_STATUS_ALIASES: Record<string, string> = {
	succeeded: 'success',
	ok: 'success',
	pass: 'success',
	passed: 'success',
	failure: 'failed',
	error: 'failed',
	rolled_back: 'failed',
	aborted: 'failed',
	in_progress: 'pending',
	running: 'pending',
	queued: 'pending'
};

export function normalizeDeploymentStatus(raw: unknown): ParseResult {
	return parseEnum(raw, DEPLOY_STATUS_ALLOWED, DEPLOY_STATUS_ALIASES, 'deployment status');
}

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** For optional task.spec_id — null clears the link. */
export function normalizeOptionalSpecId(raw: unknown, fieldLabel: string): ParseResult | { ok: true; value: string | null } {
	if (raw === null) return { ok: true, value: null };
	if (typeof raw !== 'string') {
		return { ok: false, error: `${fieldLabel} must be a string UUID or null` };
	}
	const t = raw.trim();
	if (!t) return { ok: false, error: `${fieldLabel} cannot be an empty string` };
	if (!UUID_RE.test(t)) return { ok: false, error: `${fieldLabel} must be a valid UUID` };
	return { ok: true, value: t };
}

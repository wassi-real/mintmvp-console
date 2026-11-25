import { createHash } from 'node:crypto';
import { json, type RequestEvent } from '@sveltejs/kit';
import type { Row } from '#lib/database.types.ts';
import {
	API_RESOURCES,
	resourceBySlug,
	type ApiField,
	type ApiResource
} from '#lib/api-reference.ts';
import { planOf, type Plan } from '#lib/plans.ts';
import { planFor } from './billing.ts';
import { untyped } from './crud.ts';
import { getServiceClient } from './supabase.ts';
import { isUuid } from './validate.ts';
import { cleanName, type Actor, type WorkScope } from './work.ts';

const RATE_HEADERS = [
	'x-ratelimit-limit',
	'x-ratelimit-remaining',
	'x-ratelimit-reset',
	'x-monthly-write-limit',
	'x-monthly-writes-remaining',
	'retry-after'
];

const CORS = {
	'access-control-allow-origin': '*',
	'access-control-allow-headers': 'authorization, content-type, x-api-key, x-agent-name',
	'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
	'access-control-expose-headers': RATE_HEADERS.join(', '),
	'access-control-max-age': '86400'
};

const BINDINGS: Record<string, { table: string; order: string; listSelect?: string }> = {
	tasks: { table: 'tasks', order: 'created_at' },
	reports: {
		table: 'reports',
		order: 'created_at',
		listSelect: 'id, project_id, folder_id, title, created_by, created_at, updated_at'
	},
	'report-folders': { table: 'report_folders', order: 'sort_order' },
	'monitoring-targets': { table: 'monitoring_targets', order: 'sort_order' },
	activity: { table: 'activity_log', order: 'created_at' }
};

export interface ApiContext {
	keyId: string;
	keyName: string;
	/** The agent's name: the X-Agent-Name header, or the key name. Claims belong to this name. */
	actor: string;
	premium: boolean;
	plan: Plan;
	ownerId: string;
	project: Row<'projects'>;
	agent: Actor;
	work: WorkScope;
}

export function apiOptions(): Response {
	return new Response(null, { status: 204, headers: CORS });
}

export function reply(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
	return json(body, { status, headers: { ...CORS, ...headers } });
}

export function fail(status: number, error: string, headers: Record<string, string> = {}): Response {
	return reply({ error }, status, headers);
}

// ─── Rate limits ─────────────────────────────────────────────────────────────

const fallbackWindows = new Map<string, { window: number; hits: number }>();

function monthLabel(date: Date): string {
	return date.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/**
 * Counts this request against the key's per-minute limit and, for writes, the project's monthly
 * limit. Returns a 429 response when a limit is reached.
 */
async function meter(
	event: RequestEvent,
	keyId: string,
	projectId: string,
	plan: Plan,
	premium: boolean
): Promise<Response | null> {
	const write = !['GET', 'HEAD', 'OPTIONS'].includes(event.request.method);
	const now = Date.now();
	const minuteReset = (Math.floor(now / 60_000) + 1) * 60;
	const today = new Date(now);
	const monthReset = Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 1) / 1000;

	let allowed = true;
	let reason: string | null = null;
	let minuteHits = 1;
	let monthWrites: number | null = null;

	const { data, error } = await untyped({ supabase: getServiceClient() }).rpc('api_hit', {
		p_key: keyId,
		p_project: projectId,
		p_write: write,
		p_minute_limit: plan.apiPerMinute,
		p_month_limit: plan.apiWritesPerMonth
	});
	const row = (Array.isArray(data) ? data[0] : data) as
		| { allowed: boolean; minute_hits: number; month_writes: number; reason: string | null }
		| null
		| undefined;

	if (error || !row) {
		if (error && error.code !== 'PGRST202') console.error('api rate limit failed:', error.message);
		const windowId = Math.floor(now / 60_000);
		const entry = fallbackWindows.get(keyId);
		minuteHits = entry && entry.window === windowId ? entry.hits + 1 : 1;
		fallbackWindows.set(keyId, { window: windowId, hits: minuteHits });
		allowed = minuteHits <= plan.apiPerMinute;
		reason = allowed ? null : 'minute';
	} else {
		allowed = row.allowed;
		reason = row.reason;
		minuteHits = row.minute_hits;
		monthWrites = row.month_writes;
	}

	const headers: Record<string, string> = {
		'x-ratelimit-limit': String(plan.apiPerMinute),
		'x-ratelimit-remaining': String(Math.max(plan.apiPerMinute - minuteHits, 0)),
		'x-ratelimit-reset': String(minuteReset),
		'x-monthly-write-limit': String(plan.apiWritesPerMonth)
	};
	if (monthWrites !== null) {
		headers['x-monthly-writes-remaining'] = String(Math.max(plan.apiWritesPerMonth - monthWrites, 0));
	}
	event.locals.apiHeaders = headers;
	if (allowed) return null;

	if (reason === 'month') {
		const wait = Math.max(1, Math.ceil(monthReset - now / 1000));
		const upgrade = premium
			? 'It resets on the 1st of next month.'
			: `Mint ($5 a month) raises it to ${planOf(true).apiWritesPerMonth.toLocaleString('en-US')}.`;
		return fail(
			429,
			`This project has used its ${plan.apiWritesPerMonth.toLocaleString('en-US')} API writes for ${monthLabel(today)}. Reads still work. ${upgrade}`,
			{ ...headers, 'retry-after': String(wait) }
		);
	}
	const wait = Math.max(1, Math.ceil(minuteReset - now / 1000));
	return fail(
		429,
		`Too many requests. This key can make ${plan.apiPerMinute} requests a minute on the ${plan.name} plan. Try again in ${wait} seconds.`,
		{ ...headers, 'retry-after': String(wait) }
	);
}

function from(table: string) {
	return untyped({ supabase: getServiceClient() }).from(table);
}

function tokenFrom(request: Request): string {
	const header = request.headers.get('authorization') ?? '';
	if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
	return (request.headers.get('x-api-key') ?? '').trim();
}

export async function authenticate(event: RequestEvent): Promise<ApiContext | Response> {
	const token = tokenFrom(event.request);
	if (!token.startsWith('mint_') || token.length < 20) {
		return fail(401, 'Send a project API key in Authorization: Bearer mint_… or X-Api-Key.');
	}

	const keyHash = createHash('sha256').update(token).digest('hex');
	const { data: key, error: keyError } = await getServiceClient()
		.from('api_keys')
		.select('id, name, project_id, project:projects(*)')
		.eq('key_hash', keyHash)
		.maybeSingle();
	if (keyError) {
		console.error('api key lookup failed:', keyError.message);
		return fail(500, 'Could not check that API key.');
	}
	const project = key?.project as Row<'projects'> | null | undefined;
	if (!key || !project) return fail(401, 'That API key is not valid. It may have been revoked.');

	const { data: owner } = await getServiceClient()
		.from('organization_members')
		.select('user_id')
		.eq('organization_id', project.organization_id)
		.eq('role', 'owner')
		.limit(1)
		.maybeSingle();
	if (!owner) return fail(500, 'This workspace has no owner, so the API cannot run.');

	const { premium } = await planFor(getServiceClient(), owner.user_id);
	const plan = planOf(premium);
	const limited = await meter(event, key.id, project.id, plan, premium);
	if (limited) return limited;

	const named = cleanName(event.request.headers.get('x-agent-name') ?? '');
	const actor = named || cleanName(key.name) || 'Agent';

	void getServiceClient()
		.from('api_keys')
		.update({ last_used_at: new Date().toISOString() })
		.eq('id', key.id)
		.then(({ error }) => {
			if (error) console.error('api key last_used update failed:', error.message);
		});

	return {
		keyId: key.id,
		keyName: key.name,
		actor,
		premium,
		plan,
		ownerId: owner.user_id,
		project,
		agent: { name: actor, userId: null, via: 'api', person: false },
		work: {
			db: getServiceClient(),
			project: { id: project.id, organization_id: project.organization_id, name: project.name },
			workPerMonth: plan.workPerMonth
		}
	};
}

function dbMessage(error: { message: string; code?: string }): string {
	if (error.code === 'P0001' || /monthly limit|premium/i.test(error.message)) return error.message;
	if (error.code === '23503') return 'That refers to a record outside this project, or one that does not exist.';
	if (error.code === '23514' || error.code === '22P02') return 'A field has a value this project does not accept.';
	console.error('public api write failed:', error.message);
	return 'Could not save that change.';
}

export async function readJson(request: Request): Promise<{ value: Record<string, unknown> } | { error: string }> {
	const text = await request.text();
	if (text.length > 500_000) return { error: 'The request body is too large.' };
	if (!text.trim()) return { value: {} };
	try {
		const parsed = JSON.parse(text) as unknown;
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			return { error: 'Send a JSON object.' };
		}
		return { value: parsed as Record<string, unknown> };
	} catch {
		return { error: 'The request body is not valid JSON.' };
	}
}

function pickFields(
	input: Record<string, unknown>,
	fields: readonly ApiField[],
	mode: 'create' | 'update'
): { value: Record<string, unknown> } | { error: string } {
	const value: Record<string, unknown> = {};
	for (const field of fields) {
		if (!(field.name in input)) {
			if (mode === 'create' && field.required) return { error: `${field.name} is required.` };
			continue;
		}
		const parsed = parseField(field, input[field.name]);
		if ('error' in parsed) return parsed;
		value[field.name] = parsed.value;
	}
	if (mode === 'update' && Object.keys(value).length === 0) {
		return { error: 'Include at least one field to change.' };
	}
	return { value };
}

function parseField(field: ApiField, raw: unknown): { value: unknown } | { error: string } {
	if (raw === null) {
		if (field.nullable) return { value: null };
		return { error: `${field.name} cannot be null.` };
	}
	if (raw === '') {
		if (field.kind === 'enum' && field.options?.includes('')) return { value: '' };
		if (field.nullable) return { value: null };
		if (!field.required && (field.kind === 'url' || field.kind === 'string' || field.kind === 'text')) {
			return { value: '' };
		}
		return { error: `${field.name} cannot be empty.` };
	}

	if (field.kind === 'boolean') {
		if (typeof raw !== 'boolean') return { error: `${field.name} must be true or false.` };
		return { value: raw };
	}

	if (field.kind === 'number') {
		const number = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : Number.NaN;
		if (!Number.isFinite(number)) return { error: `${field.name} must be a number.` };
		if (field.min != null && number < field.min) return { error: `${field.name} must be at least ${field.min}.` };
		return { value: number };
	}

	if (field.kind === 'tags') {
		const list = Array.isArray(raw)
			? raw
			: typeof raw === 'string'
				? raw.split(',')
				: null;
		if (!list || list.some((item) => typeof item !== 'string')) {
			return { error: `${field.name} must be a list of strings.` };
		}
		return { value: list.map((item) => item.trim()).filter(Boolean).slice(0, 20) };
	}

	if (typeof raw !== 'string') return { error: `${field.name} must be a string.` };
	const text = raw.trim();

	if (field.kind === 'uuid') {
		if (!isUuid(text)) return { error: `${field.name} must be a UUID.` };
		return { value: text };
	}
	if (field.kind === 'date') {
		if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return { error: `${field.name} must be a date, YYYY-MM-DD.` };
		return { value: text };
	}
	if (field.kind === 'url') {
		if (!/^https?:\/\//i.test(text)) return { error: `${field.name} must start with http:// or https://.` };
		if (text.length > 500) return { error: `${field.name} is too long.` };
		return { value: text };
	}
	if (field.kind === 'enum') {
		if (field.options && !field.options.includes(text)) {
			return { error: `${field.name} must be one of: ${field.options.filter(Boolean).join(', ')}.` };
		}
		return { value: text };
	}
	if (field.max && text.length > field.max) return { error: `${field.name} must be ${field.max} characters or fewer.` };
	if (!text) return { error: `${field.name} cannot be empty.` };
	return { value: text };
}

export function pageOf(url: URL): { limit: number; offset: number } | { error: string } {
	const limitRaw = url.searchParams.get('limit');
	const offsetRaw = url.searchParams.get('offset');
	const limit = limitRaw == null ? 50 : Number(limitRaw);
	const offset = offsetRaw == null ? 0 : Number(offsetRaw);
	if (!Number.isInteger(limit) || limit < 1 || limit > 100) return { error: 'limit must be a whole number from 1 to 100.' };
	if (!Number.isInteger(offset) || offset < 0) return { error: 'offset must be a whole number, 0 or more.' };
	return { limit, offset };
}

async function recordActivity(ctx: ApiContext, action: string, metadata: Record<string, string> = {}): Promise<void> {
	const { error } = await from('activity_log').insert({
		project_id: ctx.project.id,
		action: action.slice(0, 300),
		actor: ctx.actor,
		metadata: { ...metadata, via: 'api', key_id: ctx.keyId }
	});
	if (error) console.error('api activity insert failed:', error.message);
}

async function assertMonthly(ctx: ApiContext, resource: ApiResource): Promise<string | null> {
	const cap = resource.monthly ? (ctx.premium ? resource.monthly.premium : resource.monthly.free) : 0;
	if (!resource.monthly || cap === 0) return null;
	const binding = BINDINGS[resource.slug];
	if (!binding) return null;
	const start = new Date();
	start.setUTCDate(1);
	start.setUTCHours(0, 0, 0, 0);
	const { count, error } = await from(binding.table)
		.select('id', { count: 'exact', head: true })
		.eq('project_id', ctx.project.id)
		.gte('created_at', start.toISOString());
	if (error) {
		console.error('api limit check failed:', error.message);
		return 'Could not check the monthly limit. Please try again.';
	}
	if ((count ?? 0) >= cap) {
		return `Monthly limit reached for ${resource.title.toLowerCase()} (${cap} per project). Mint ($5 a month) raises it.`;
	}
	return null;
}

function projectPayload(project: Row<'projects'>) {
	return {
		id: project.id,
		name: project.name,
		description: project.description,
		status: project.status,
		priority: project.priority,
		target_date: project.target_date,
		repo_url: project.repo_url,
		staging_url: project.staging_url,
		production_url: project.production_url,
		created_at: project.created_at,
		updated_at: project.updated_at
	};
}

export async function handleIndex(event: RequestEvent): Promise<Response> {
	const ctx = await authenticate(event);
	if (ctx instanceof Response) return ctx;
	const period = new Date().toISOString().slice(0, 7);
	const { data: usage } = await from('api_usage_monthly')
		.select('writes, reads')
		.eq('project_id', ctx.project.id)
		.eq('period', period)
		.maybeSingle();
	const writes = Number(usage?.writes ?? 0);
	return reply({
		project: projectPayload(ctx.project),
		key: { id: ctx.keyId, name: ctx.keyName },
		agent: ctx.actor,
		plan: {
			name: ctx.plan.name,
			requests_per_minute: ctx.plan.apiPerMinute,
			writes_per_month: ctx.plan.apiWritesPerMonth,
			work_items_per_month: ctx.plan.workPerMonth
		},
		usage: {
			period,
			writes,
			reads: Number(usage?.reads ?? 0),
			writes_remaining: Math.max(ctx.plan.apiWritesPerMonth - writes, 0)
		},
		start: {
			board: '/api/v1/board',
			work: '/api/v1/work'
		},
		resources: API_RESOURCES.map((resource) => ({
			name: resource.slug,
			methods: resource.methods,
			path: `/api/v1/${resource.slug}`
		}))
	});
}

export async function handleCollection(event: RequestEvent): Promise<Response> {
	const slug = event.params.resource ?? '';
	const resource = resourceBySlug(slug);
	if (!resource) return fail(404, 'That resource does not exist. See /docs.');
	const ctx = await authenticate(event);
	if (ctx instanceof Response) return ctx;

	const method = event.request.method;
	if (method !== 'GET' && method !== 'POST' && method !== 'PATCH' && method !== 'DELETE') {
		return fail(405, 'Use GET, POST, PATCH or DELETE.');
	}
	if (!resource.methods.includes(method)) {
		return fail(405, `${method} is not allowed on ${resource.title}.`);
	}
	if (slug !== 'project' && (method === 'PATCH' || method === 'DELETE')) {
		return fail(405, `Use /api/v1/${slug}/{id} to change or delete one record.`);
	}

	if (slug === 'project') {
		if (method === 'GET') return reply({ data: projectPayload(ctx.project) });
		const body = await readJson(event.request);
		if ('error' in body) return fail(400, body.error);
		const picked = pickFields(body.value, resource.fields, 'update');
		if ('error' in picked) return fail(400, picked.error);
		const { data, error } = await from('projects')
			.update(picked.value)
			.eq('id', ctx.project.id)
			.select('*')
			.single();
		if (error || !data) return fail(400, error ? dbMessage(error) : 'Could not update the project.');
		await recordActivity(ctx, 'API updated the project');
		return reply({ data: projectPayload(data as Row<'projects'>) });
	}

	const binding = BINDINGS[slug];
	if (!binding) return fail(404, 'That resource does not exist. See /docs.');

	if (method === 'GET') {
		const page = pageOf(event.url);
		if ('error' in page) return fail(400, page.error);
		let query = from(binding.table)
			.select(binding.listSelect ?? '*', { count: 'exact' })
			.eq('project_id', ctx.project.id);
		for (const name of resource.filters ?? []) {
			const raw = event.url.searchParams.get(name);
			if (!raw) continue;
			const field = resource.fields.find((item) => item.name === name);
			if (field?.options && !field.options.includes(raw)) {
				return fail(400, `${name} must be one of: ${field.options.filter(Boolean).join(', ')}.`);
			}
			if (field?.kind === 'uuid' && !isUuid(raw)) return fail(400, `${name} must be a UUID.`);
			query = query.eq(name, raw);
		}
		const { data, error, count } = await query
			.order(binding.order, { ascending: false })
			.range(page.offset, page.offset + page.limit - 1);
		if (error) {
			console.error('public api list failed:', error.message);
			return fail(500, 'Could not list those records.');
		}
		return reply({ data: data ?? [], count: count ?? 0, limit: page.limit, offset: page.offset });
	}

	const body = await readJson(event.request);
	if ('error' in body) return fail(400, body.error);
	const picked = pickFields(body.value, resource.fields, 'create');
	if ('error' in picked) return fail(400, picked.error);
	const limited = await assertMonthly(ctx, resource);
	if (limited) return fail(402, limited);

	const extra: Record<string, unknown> = { project_id: ctx.project.id };
	if (slug === 'tasks') extra.created_by = ctx.ownerId;
	if (slug === 'reports') extra.created_by = ctx.actor;

	const { data, error } = await from(binding.table)
		.insert({ ...picked.value, ...extra })
		.select('*')
		.single();
	if (error || !data) return fail(400, error ? dbMessage(error) : 'Could not create that record.');
	await recordActivity(ctx, `API created a ${resource.title.toLowerCase().replace(/s$/, '')}`, {
		id: String((data as { id: string }).id)
	});
	return reply({ data }, 201);
}

export async function handleItem(event: RequestEvent): Promise<Response> {
	const slug = event.params.resource ?? '';
	const id = event.params.id ?? '';
	const resource = resourceBySlug(slug);
	if (!resource || slug === 'project' || !BINDINGS[slug]) return fail(404, 'That resource does not exist. See /docs.');
	if (!isUuid(id)) return fail(400, 'The id must be a UUID.');
	const ctx = await authenticate(event);
	if (ctx instanceof Response) return ctx;

	const method = event.request.method;
	if (method === 'POST') return fail(405, 'POST creates a record on the collection, without an id.');
	if (method !== 'GET' && method !== 'PATCH' && method !== 'DELETE') return fail(405, 'Use GET, PATCH or DELETE.');
	if (method !== 'GET' && !resource.methods.includes(method)) {
		return fail(405, `${method} is not allowed on ${resource.title}.`);
	}

	const binding = BINDINGS[slug];
	if (method === 'GET') {
		const { data, error } = await from(binding.table)
			.select('*')
			.eq('id', id)
			.eq('project_id', ctx.project.id)
			.maybeSingle();
		if (error) return fail(500, 'Could not load that record.');
		if (!data) return fail(404, 'That record is not in this project.');
		if (slug === 'monitoring-targets') {
			const { data: checks } = await from('monitoring_check_runs')
				.select('id, checked_at, ok, http_status, duration_ms, error_message')
				.eq('target_id', id)
				.order('checked_at', { ascending: false })
				.limit(20);
			return reply({ data: { ...data, recent_checks: checks ?? [] } });
		}
		return reply({ data });
	}

	if (method === 'DELETE') {
		const { data, error } = await from(binding.table)
			.delete()
			.eq('id', id)
			.eq('project_id', ctx.project.id)
			.select('id')
			.maybeSingle();
		if (error) return fail(400, dbMessage(error));
		if (!data) return fail(404, 'That record is not in this project.');
		await recordActivity(ctx, `API deleted a ${resource.title.toLowerCase().replace(/s$/, '')}`, { id });
		return reply({ ok: true });
	}

	const body = await readJson(event.request);
	if ('error' in body) return fail(400, body.error);
	const picked = pickFields(body.value, resource.fields, 'update');
	if ('error' in picked) return fail(400, picked.error);
	const { data, error } = await from(binding.table)
		.update(picked.value)
		.eq('id', id)
		.eq('project_id', ctx.project.id)
		.select('*')
		.maybeSingle();
	if (error) return fail(400, dbMessage(error));
	if (!data) return fail(404, 'That record is not in this project.');
	await recordActivity(ctx, `API updated a ${resource.title.toLowerCase().replace(/s$/, '')}`, { id });
	return reply({ data });
}

async function taskInProject(ctx: ApiContext, taskId: string) {
	const { data } = await from('tasks').select('id').eq('id', taskId).eq('project_id', ctx.project.id).maybeSingle();
	return Boolean(data);
}

export async function handleComments(event: RequestEvent): Promise<Response> {
	const taskId = event.params.id ?? '';
	if (!isUuid(taskId)) return fail(400, 'The task id must be a UUID.');
	const ctx = await authenticate(event);
	if (ctx instanceof Response) return ctx;
	if (!(await taskInProject(ctx, taskId))) return fail(404, 'That task is not in this project.');

	if (event.request.method === 'GET') {
		const { data, error } = await from('task_comments')
			.select('id, task_id, body, author_name, author_user_id, created_at')
			.eq('task_id', taskId)
			.order('created_at', { ascending: true })
			.limit(200);
		if (error) return fail(500, 'Could not load comments.');
		return reply({ data: data ?? [] });
	}

	if (event.request.method !== 'POST') return fail(405, 'Use GET or POST on comments.');
	const body = await readJson(event.request);
	if ('error' in body) return fail(400, body.error);
	const picked = pickFields(body.value, [{ name: 'body', kind: 'text', required: true, max: 5000 }], 'create');
	if ('error' in picked) return fail(400, picked.error);
	const { data, error } = await from('task_comments')
		.insert({
			task_id: taskId,
			body: picked.value.body,
			author_user_id: ctx.ownerId,
			author_name: ctx.actor
		})
		.select('id, task_id, body, author_name, author_user_id, created_at')
		.single();
	if (error || !data) return fail(400, error ? dbMessage(error) : 'Could not add the comment.');
	await recordActivity(ctx, 'API commented on a task', { task_id: taskId });
	return reply({ data }, 201);
}

export async function handleComment(event: RequestEvent): Promise<Response> {
	if (event.request.method !== 'DELETE') return fail(405, 'Use DELETE to remove a comment.');
	const taskId = event.params.id ?? '';
	const commentId = event.params.commentId ?? '';
	if (!isUuid(taskId) || !isUuid(commentId)) return fail(400, 'Ids must be UUIDs.');
	const ctx = await authenticate(event);
	if (ctx instanceof Response) return ctx;
	if (!(await taskInProject(ctx, taskId))) return fail(404, 'That task is not in this project.');
	const { data, error } = await from('task_comments')
		.delete()
		.eq('id', commentId)
		.eq('task_id', taskId)
		.select('id')
		.maybeSingle();
	if (error) return fail(400, dbMessage(error));
	if (!data) return fail(404, 'That comment is not on this task.');
	await recordActivity(ctx, 'API deleted a task comment', { task_id: taskId });
	return reply({ ok: true });
}

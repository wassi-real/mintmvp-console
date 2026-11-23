import { createHash } from 'node:crypto';
import { json, type RequestEvent } from '@sveltejs/kit';
import { ANTHROPIC_API_KEY } from '$app/env/private';
import type { Row } from '#lib/database.types.ts';
import {
	API_RESOURCES,
	resourceBySlug,
	SLICE_FIELDS,
	type ApiField,
	type ApiResource
} from '#lib/api-reference.ts';
import { allowance, consumeAiRequest, refundAiRequest } from './billing.ts';
import type { Profile, ProjectContext } from './context.ts';
import { untyped } from './crud.ts';
import { runMintAi, type ChatTurn } from './mintai.ts';
import { getServiceClient } from './supabase.ts';
import { isUuid } from './validate.ts';

const CORS = {
	'access-control-allow-origin': '*',
	'access-control-allow-headers': 'authorization, content-type, x-api-key',
	'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
	'access-control-max-age': '86400'
};

const BINDINGS: Record<string, { table: string; order: string; listSelect?: string }> = {
	tasks: { table: 'tasks', order: 'created_at' },
	milestones: { table: 'milestones', order: 'created_at' },
	specs: { table: 'specs', order: 'created_at' },
	reports: {
		table: 'reports',
		order: 'created_at',
		listSelect: 'id, project_id, folder_id, title, created_by, created_at, updated_at'
	},
	'report-folders': { table: 'report_folders', order: 'sort_order' },
	tests: { table: 'tests', order: 'id' },
	incidents: { table: 'incidents', order: 'created_at' },
	deployments: { table: 'deployments', order: 'created_at' },
	environments: { table: 'project_environments', order: 'id' },
	payments: { table: 'payments', order: 'paid_at' },
	expenses: { table: 'expenses', order: 'spent_at' },
	'monitoring-targets': { table: 'monitoring_targets', order: 'sort_order' },
	activity: { table: 'activity_log', order: 'created_at' },
	'github-commits': { table: 'github_commits', order: 'committed_at' },
	'github-pull-requests': { table: 'github_pull_requests', order: 'created_at' },
	'github-branches': { table: 'github_branches', order: 'updated_at' },
	'github-builds': { table: 'github_ci_runs', order: 'created_at' },
	'github-deployments': { table: 'github_deployments', order: 'created_at' }
};

export interface ApiContext {
	keyId: string;
	keyName: string;
	actor: string;
	premium: boolean;
	ownerId: string;
	project: Row<'projects'>;
	profile: Profile;
	mint: ProjectContext;
}

export function apiOptions(): Response {
	return new Response(null, { status: 204, headers: CORS });
}

function reply(body: unknown, status = 200): Response {
	return json(body, { status, headers: CORS });
}

function fail(status: number, error: string): Response {
	return reply({ error }, status);
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
		.select('id, name, project_id')
		.eq('key_hash', keyHash)
		.maybeSingle();
	if (keyError) {
		console.error('api key lookup failed:', keyError.message);
		return fail(500, 'Could not check that API key.');
	}
	if (!key) return fail(401, 'That API key is not valid. It may have been revoked.');

	const { data: project, error: projectError } = await getServiceClient()
		.from('projects')
		.select('*')
		.eq('id', key.project_id)
		.maybeSingle();
	if (projectError || !project) return fail(401, 'That API key is not valid. It may have been revoked.');

	const { data: ownerMember } = await getServiceClient()
		.from('organization_members')
		.select('user_id')
		.eq('organization_id', project.organization_id)
		.eq('role', 'owner')
		.limit(1)
		.maybeSingle();
	if (!ownerMember) return fail(500, 'This workspace has no owner, so the API cannot run.');

	const { data: owner } = await getServiceClient()
		.from('users')
		.select('*')
		.eq('id', ownerMember.user_id)
		.maybeSingle();
	if (!owner) return fail(500, 'This workspace has no owner, so the API cannot run.');

	const plan = await allowance(getServiceClient(), owner.id);
	const actor = `API · ${key.name}`;
	const profile: Profile = {
		...owner,
		organization_id: project.organization_id,
		full_name: actor,
		role: 'owner'
	};
	const mint: ProjectContext = {
		supabase: getServiceClient(),
		profile,
		canEdit: true,
		isOwner: true,
		project
	};

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
		premium: plan.premium,
		ownerId: owner.id,
		project,
		profile,
		mint
	};
}

function dbMessage(error: { message: string; code?: string }): string {
	if (error.code === 'P0001' || /monthly limit|premium/i.test(error.message)) return error.message;
	if (error.code === '23503') return 'That refers to a record outside this project, or one that does not exist.';
	if (error.code === '23514' || error.code === '22P02') return 'A field has a value this project does not accept.';
	console.error('public api write failed:', error.message);
	return 'Could not save that change.';
}

async function readJson(request: Request): Promise<{ value: Record<string, unknown> } | { error: string }> {
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

function pageOf(url: URL): { limit: number; offset: number } | { error: string } {
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
		return `Monthly limit reached for ${resource.title.toLowerCase()} (${cap} per project). Premium is $5 a month.`;
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
	const plan = await allowance(getServiceClient(), ctx.ownerId);
	return reply({
		project: projectPayload(ctx.project),
		key: { id: ctx.keyId, name: ctx.keyName },
		mintai: {
			configured: Boolean(ANTHROPIC_API_KEY),
			premium: plan.premium,
			used: plan.used,
			remaining: plan.remaining
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

async function milestoneInProject(ctx: ApiContext, milestoneId: string) {
	const { data } = await from('milestones')
		.select('id')
		.eq('id', milestoneId)
		.eq('project_id', ctx.project.id)
		.maybeSingle();
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

export async function handleSlices(event: RequestEvent): Promise<Response> {
	const milestoneId = event.params.id ?? '';
	if (!isUuid(milestoneId)) return fail(400, 'The milestone id must be a UUID.');
	const ctx = await authenticate(event);
	if (ctx instanceof Response) return ctx;
	if (!(await milestoneInProject(ctx, milestoneId))) return fail(404, 'That milestone is not in this project.');

	if (event.request.method === 'GET') {
		const { data, error } = await from('milestone_slices').select('*').eq('milestone_id', milestoneId).order('sort_order');
		if (error) return fail(500, 'Could not load steps.');
		return reply({ data: data ?? [] });
	}
	if (event.request.method !== 'POST') return fail(405, 'Use GET or POST on steps.');
	const body = await readJson(event.request);
	if ('error' in body) return fail(400, body.error);
	const picked = pickFields(body.value, SLICE_FIELDS, 'create');
	if ('error' in picked) return fail(400, picked.error);
	const { data, error } = await from('milestone_slices')
		.insert({ ...picked.value, milestone_id: milestoneId })
		.select('*')
		.single();
	if (error || !data) return fail(400, error ? dbMessage(error) : 'Could not add the step.');
	await recordActivity(ctx, 'API added a milestone step', { milestone_id: milestoneId });
	return reply({ data }, 201);
}

export async function handleSlice(event: RequestEvent): Promise<Response> {
	const milestoneId = event.params.id ?? '';
	const sliceId = event.params.sliceId ?? '';
	if (!isUuid(milestoneId) || !isUuid(sliceId)) return fail(400, 'Ids must be UUIDs.');
	const ctx = await authenticate(event);
	if (ctx instanceof Response) return ctx;
	if (!(await milestoneInProject(ctx, milestoneId))) return fail(404, 'That milestone is not in this project.');

	if (event.request.method === 'DELETE') {
		const { data, error } = await from('milestone_slices')
			.delete()
			.eq('id', sliceId)
			.eq('milestone_id', milestoneId)
			.select('id')
			.maybeSingle();
		if (error) return fail(400, dbMessage(error));
		if (!data) return fail(404, 'That step is not on this milestone.');
		await recordActivity(ctx, 'API deleted a milestone step', { milestone_id: milestoneId });
		return reply({ ok: true });
	}
	if (event.request.method !== 'PATCH') return fail(405, 'Use PATCH or DELETE on a step.');
	const body = await readJson(event.request);
	if ('error' in body) return fail(400, body.error);
	const picked = pickFields(body.value, SLICE_FIELDS, 'update');
	if ('error' in picked) return fail(400, picked.error);
	const { data, error } = await from('milestone_slices')
		.update(picked.value)
		.eq('id', sliceId)
		.eq('milestone_id', milestoneId)
		.select('*')
		.maybeSingle();
	if (error) return fail(400, dbMessage(error));
	if (!data) return fail(404, 'That step is not on this milestone.');
	await recordActivity(ctx, 'API updated a milestone step', { milestone_id: milestoneId });
	return reply({ data });
}

export async function handleAi(event: RequestEvent): Promise<Response> {
	const ctx = await authenticate(event);
	if (ctx instanceof Response) return ctx;

	if (event.request.method === 'GET') {
		const plan = await allowance(getServiceClient(), ctx.ownerId);
		const { data: chats } = await from('ai_chats')
			.select('id, title, updated_at')
			.eq('project_id', ctx.project.id)
			.eq('user_id', ctx.ownerId)
			.order('updated_at', { ascending: false })
			.limit(20);
		const requested = event.url.searchParams.get('chat');
		let messages: unknown[] = [];
		if (requested && isUuid(requested)) {
			const owns = (chats ?? []).some((chat) => chat.id === requested);
			if (!owns) return fail(404, 'That chat is not in this project.');
			const { data } = await from('ai_messages')
				.select('id, role, content, created_at')
				.eq('chat_id', requested)
				.order('created_at')
				.limit(200);
			messages = data ?? [];
		}
		return reply({
			configured: Boolean(ANTHROPIC_API_KEY),
			premium: plan.premium,
			used: plan.used,
			remaining: plan.remaining,
			chats: chats ?? [],
			messages
		});
	}

	if (event.request.method !== 'POST') return fail(405, 'Use GET or POST on /api/v1/ai.');
	const body = await readJson(event.request);
	if ('error' in body) return fail(400, body.error);
	const message = typeof body.value.message === 'string' ? body.value.message.trim() : '';
	if (!message) return fail(400, 'message is required.');
	if (message.length > 4000) return fail(400, 'Keep a message to 4,000 characters or fewer.');

	const plan = await allowance(getServiceClient(), ctx.ownerId);
	if (!plan.ready) return fail(503, 'MintAI storage is not ready yet.');
	if (!plan.premium) return fail(402, 'MintAI is part of Premium. It is $5 a month.');
	if (!ANTHROPIC_API_KEY) return fail(503, 'MintAI is not configured yet.');

	const spent = await consumeAiRequest(getServiceClient(), ctx.ownerId);
	if ('error' in spent) return fail(402, spent.error);

	const chatIdRaw = typeof body.value.chatId === 'string' ? body.value.chatId : '';
	const startNew = body.value.newChat === true || !isUuid(chatIdRaw);
	let chatId = isUuid(chatIdRaw) ? chatIdRaw : '';

	if (!startNew) {
		const { data: existing } = await from('ai_chats')
			.select('id')
			.eq('id', chatId)
			.eq('project_id', ctx.project.id)
			.eq('user_id', ctx.ownerId)
			.maybeSingle();
		if (!existing) {
			await refundAiRequest(ctx.ownerId);
			return fail(404, 'That chat is not in this project.');
		}
	} else {
		const { data, error } = await from('ai_chats')
			.insert({
				project_id: ctx.project.id,
				user_id: ctx.ownerId,
				title: message.slice(0, 80)
			})
			.select('id')
			.single();
		if (error || !data) {
			await refundAiRequest(ctx.ownerId);
			return fail(500, 'Could not save the chat.');
		}
		chatId = String(data.id);
	}

	const { data: previous } = await from('ai_messages')
		.select('role, content')
		.eq('chat_id', chatId)
		.order('created_at')
		.limit(200);
	const history: ChatTurn[] = ((previous ?? []) as { role: string; content: string }[])
		.filter((turn) => turn.role === 'user' || turn.role === 'assistant')
		.slice(-24)
		.map((turn) => ({ role: turn.role as 'user' | 'assistant', content: turn.content }));

	const result = await runMintAi({
		context: ctx.mint,
		history,
		memory: 'This message arrived through the project API key.',
		message
	});
	if ('error' in result) {
		await refundAiRequest(ctx.ownerId);
		return fail(502, result.error);
	}

	const replyText = result.text.slice(0, 20000);
	const { error: saveError } = await from('ai_messages').insert([
		{ chat_id: chatId, role: 'user', content: message },
		{ chat_id: chatId, role: 'assistant', content: replyText }
	]);
	if (saveError) console.error('api MintAI history save failed:', saveError.message);
	await from('ai_chats').update({ updated_at: new Date().toISOString() }).eq('id', chatId);

	return reply({ chatId, reply: replyText, remaining: spent.remaining });
}

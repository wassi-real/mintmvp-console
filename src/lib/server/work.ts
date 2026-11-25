import type { SupabaseClient } from '@supabase/supabase-js';
import {
	CLAIM_HOURS,
	CLAIMABLE_STATES,
	MAX_CLAIM_HOURS,
	OPEN_STATES,
	STALE_HOURS,
	defaultNext,
	isDefaultNext,
	type WorkStateId
} from '#lib/work-rules.ts';
import { notifyStaff } from './activity.ts';
import { isUuid } from './validate.ts';

export interface WorkItem {
	id: string;
	project_id: string;
	title: string;
	outcome: string;
	plan: string;
	acceptance: string;
	base_version: string;
	plan_version: number;
	state: WorkStateId;
	next_action: string;
	claimed_by: string | null;
	claimed_at: string | null;
	claim_until: string | null;
	available_since: string | null;
	follows_id: string | null;
	approved_by: string | null;
	approved_at: string | null;
	qa_build: string | null;
	qa_passed_at: string | null;
	accepted_by: string | null;
	accepted_at: string | null;
	released_version: string | null;
	released_at: string | null;
	created_by: string;
	created_at: string;
	updated_at: string;
}

export interface WorkEvent {
	id: string;
	work_id: string;
	kind: string;
	actor: string;
	via: 'app' | 'api';
	body: string;
	build: string;
	plan_version: number | null;
	created_at: string;
}

export interface WorkDecision {
	id: string;
	work_id: string;
	project_id: string;
	proposal: string;
	reason: string;
	status: 'pending' | 'approved' | 'deferred' | 'rejected';
	proposed_by: string;
	decided_by: string | null;
	decided_at: string | null;
	note: string;
	result_work_id: string | null;
	created_at: string;
}

/** Who is acting. People can approve, decide and accept. Agents cannot. */
export interface Actor {
	name: string;
	userId: string | null;
	via: 'app' | 'api';
	person: boolean;
}

export interface WorkScope {
	db: SupabaseClient;
	project: { id: string; organization_id: string; name: string };
	/** Set for API calls, where the database trigger cannot see the plan. */
	workPerMonth?: number | null;
}

export type Outcome<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

const ok = <T>(value: T): Outcome<T> => ({ ok: true, value });
const no = (status: number, error: string): Outcome<never> => ({ ok: false, status, error });

const HOUR = 3_600_000;
const NOT_READY = 'The work tables are not in the database yet. Apply the migration 20261125120000_work_loop_and_api_limits.sql.';

export function isMissingTable(error: { code?: string; message: string } | null | undefined): boolean {
	if (!error) return false;
	return error.code === 'PGRST205' || error.code === '42P01' || /could not find the table|does not exist/i.test(error.message);
}

function dbMessage(error: { code?: string; message: string }): string {
	if (isMissingTable(error)) return NOT_READY;
	if (error.code === 'P0001') return error.message;
	if (error.code === '23514') return 'A value is too long or not allowed.';
	console.error('work write failed:', error.message);
	return 'Could not save that change. Please try again.';
}

function stamp(): string {
	return new Date().toISOString();
}

export function cleanName(value: string): string {
	return value.replace(/\s+/g, ' ').trim().slice(0, 80);
}

function field(value: unknown, label: string, max: number, required = false): Outcome<string> {
	if (value !== undefined && value !== null && typeof value !== 'string') {
		return no(400, `${label} must be text.`);
	}
	const text = typeof value === 'string' ? value.trim() : '';
	if (required && !text) return no(400, `${label} is required.`);
	if (text.length > max) return no(400, `${label} must be ${max.toLocaleString('en-US')} characters or fewer.`);
	return ok(text);
}

export function claimActive(item: Pick<WorkItem, 'claimed_by' | 'claim_until'>, now = Date.now()): boolean {
	return Boolean(item.claimed_by && item.claim_until && Date.parse(item.claim_until) > now);
}

function isClaimable(state: string): boolean {
	return (CLAIMABLE_STATES as readonly string[]).includes(state);
}

/** When open work became free to pick up, or null while someone holds it. */
export function availableSince(item: WorkItem, now = Date.now()): string | null {
	if (!isClaimable(item.state) || claimActive(item, now)) return null;
	if (item.claimed_by && item.claim_until) return item.claim_until;
	return item.available_since ?? item.approved_at ?? item.updated_at;
}

const ACTIVITY: Record<string, string> = {
	created: 'Work proposed',
	edited: 'Plan changed',
	approved: 'Plan approved',
	claimed: 'Work claimed',
	handed_off: 'Work handed off',
	check_failed: 'Check failed',
	check_passed: 'Check passed',
	scope_proposed: 'Scope change proposed',
	scope_approved: 'Scope change approved',
	scope_deferred: 'Scope change deferred',
	scope_rejected: 'Scope change rejected',
	accepted: 'Work accepted',
	released: 'Work released',
	reopened: 'Seen again after release',
	dropped: 'Work dropped'
};

async function record(
	scope: WorkScope,
	actor: Actor,
	item: Pick<WorkItem, 'id' | 'title' | 'plan_version'>,
	kind: string,
	extra: { body?: string; build?: string } = {}
): Promise<void> {
	const { error } = await scope.db.from('work_events').insert({
		work_id: item.id,
		project_id: scope.project.id,
		kind,
		actor: actor.name,
		via: actor.via,
		body: (extra.body ?? '').slice(0, 8000),
		build: (extra.build ?? '').slice(0, 200),
		plan_version: item.plan_version
	});
	if (error) console.error('work_events insert failed:', error.message);

	const label = ACTIVITY[kind];
	if (!label) return;
	const { error: logError } = await scope.db.from('activity_log').insert({
		project_id: scope.project.id,
		action: `${label}: ${item.title}`.slice(0, 300),
		actor: actor.name,
		metadata: { work_id: item.id, via: actor.via }
	});
	if (logError) console.error('activity_log insert failed:', logError.message);
}

function link(scope: WorkScope, workId: string): string {
	return `/dashboard/projects/${scope.project.id}/work/${workId}`;
}

async function alert(scope: WorkScope, actor: Actor, workId: string, title: string, body: string) {
	await notifyStaff(scope.project, {
		kind: 'work',
		title,
		body,
		link: link(scope, workId),
		exceptUserId: actor.userId
	});
}

export async function loadWork(scope: WorkScope, id: string): Promise<Outcome<WorkItem>> {
	if (!isUuid(id)) return no(404, 'That work is not in this project.');
	const { data, error } = await scope.db
		.from('work_items')
		.select('*')
		.eq('id', id)
		.eq('project_id', scope.project.id)
		.maybeSingle();
	if (error) return no(isMissingTable(error) ? 503 : 500, isMissingTable(error) ? NOT_READY : 'Could not load that work.');
	if (!data) return no(404, 'That work is not in this project.');
	return ok(data as WorkItem);
}

/** Saves a change only if nobody else changed the work since it was read. */
async function save(scope: WorkScope, item: WorkItem, patch: Partial<WorkItem>): Promise<Outcome<WorkItem>> {
	const { data, error } = await scope.db
		.from('work_items')
		.update({ ...patch, updated_at: stamp() })
		.eq('id', item.id)
		.eq('project_id', scope.project.id)
		.eq('updated_at', item.updated_at)
		.select('*')
		.maybeSingle();
	if (error) return no(400, dbMessage(error));
	if (!data) return no(409, 'This work changed at the same moment. Load it again, then retry.');
	return ok(data as WorkItem);
}

const CLEAR_CLAIM = { claimed_by: null, claimed_at: null, claim_until: null } as const;

// ─── Reading ─────────────────────────────────────────────────────────────────

export async function listWork(
	scope: WorkScope,
	options: { state?: string; limit?: number; offset?: number; open?: boolean } = {}
): Promise<Outcome<{ items: WorkItem[]; count: number }>> {
	const limit = options.limit ?? 100;
	const offset = options.offset ?? 0;
	let query = scope.db
		.from('work_items')
		.select('*', { count: 'exact' })
		.eq('project_id', scope.project.id);
	if (options.state) query = query.eq('state', options.state);
	if (options.open) query = query.in('state', [...OPEN_STATES]);
	const { data, error, count } = await query
		.order('updated_at', { ascending: false })
		.range(offset, offset + limit - 1);
	if (error) return no(isMissingTable(error) ? 503 : 500, isMissingTable(error) ? NOT_READY : 'Could not list the work.');
	return ok({ items: (data ?? []) as WorkItem[], count: count ?? 0 });
}

export interface WorkDetail {
	item: WorkItem;
	events: WorkEvent[];
	decisions: WorkDecision[];
	follows: { id: string; title: string; state: string } | null;
	followUps: { id: string; title: string; state: string }[];
}

export async function workDetail(scope: WorkScope, id: string): Promise<Outcome<WorkDetail>> {
	const loaded = await loadWork(scope, id);
	if (!loaded.ok) return loaded;
	const item = loaded.value;
	const [events, decisions, follows, followUps] = await Promise.all([
		scope.db
			.from('work_events')
			.select('id, work_id, kind, actor, via, body, build, plan_version, created_at')
			.eq('work_id', id)
			.order('created_at', { ascending: true })
			.limit(500),
		scope.db
			.from('work_decisions')
			.select('*')
			.eq('work_id', id)
			.order('created_at', { ascending: false })
			.limit(100),
		item.follows_id
			? scope.db
					.from('work_items')
					.select('id, title, state')
					.eq('id', item.follows_id)
					.eq('project_id', scope.project.id)
					.maybeSingle()
			: Promise.resolve({ data: null }),
		scope.db
			.from('work_items')
			.select('id, title, state')
			.eq('follows_id', id)
			.eq('project_id', scope.project.id)
			.order('created_at')
			.limit(50)
	]);
	return ok({
		item,
		events: (events.data ?? []) as WorkEvent[],
		decisions: (decisions.data ?? []) as WorkDecision[],
		follows: (follows.data as WorkDetail['follows']) ?? null,
		followUps: (followUps.data ?? []) as WorkDetail['followUps']
	});
}

// ─── The three lists ─────────────────────────────────────────────────────────

export interface NeedCard {
	kind: 'approve' | 'decide' | 'accept' | 'stale';
	workId: string;
	projectId: string;
	title: string;
	detail: string;
	since: string;
	decisionId?: string;
}

export interface MovingCard {
	workId: string;
	title: string;
	state: string;
	owner: string | null;
	until: string | null;
	next: string;
	detail: string;
}

export interface SlipCard {
	workId: string;
	title: string;
	state: string;
	failures: { body: string; build: string; at: string; actor: string }[];
	fixedBuild: string | null;
	deferred: { proposal: string; status: string }[];
	released: string | null;
	follows: { id: string; title: string } | null;
	at: string;
}

export interface Board {
	ready: boolean;
	needsYou: NeedCard[];
	moving: MovingCard[];
	slipped: SlipCard[];
}

function hoursSince(iso: string, now: number): number {
	return Math.max(0, Math.floor((now - Date.parse(iso)) / HOUR));
}

function needsFrom(items: WorkItem[], decisions: WorkDecision[], now: number): NeedCard[] {
	const titles = new Map(items.map((item) => [item.id, item]));
	const cards: NeedCard[] = [];

	for (const decision of decisions) {
		const item = titles.get(decision.work_id);
		cards.push({
			kind: 'decide',
			workId: decision.work_id,
			projectId: decision.project_id,
			title: item?.title ?? 'Scope change',
			detail: `${decision.proposed_by || 'Someone'} wants to add: ${decision.proposal}`,
			since: decision.created_at,
			decisionId: decision.id
		});
	}

	for (const item of items) {
		if (item.state === 'idea') {
			cards.push({
				kind: 'approve',
				workId: item.id,
				projectId: item.project_id,
				title: item.title,
				detail: `Plan version ${item.plan_version}${item.created_by ? ` from ${item.created_by}` : ''} is waiting for your approval.`,
				since: item.updated_at
			});
		} else if (item.state === 'qa_passed') {
			cards.push({
				kind: 'accept',
				workId: item.id,
				projectId: item.project_id,
				title: item.title,
				detail: `The check passed${item.qa_build ? ` on build ${item.qa_build}` : ''}. Accept it so it can be released.`,
				since: item.qa_passed_at ?? item.updated_at
			});
		} else {
			const free = availableSince(item, now);
			if (free && now - Date.parse(free) >= STALE_HOURS * HOUR) {
				const hours = hoursSince(free, now);
				cards.push({
					kind: 'stale',
					workId: item.id,
					projectId: item.project_id,
					title: item.title,
					detail:
						item.state === 'check_failed'
							? `A check failed and nobody has picked up the fix for ${hours} hours.`
							: `Nobody has picked this up for ${hours} hours.`,
					since: free
				});
			}
		}
	}

	return cards.sort((a, b) => a.since.localeCompare(b.since));
}

function movingFrom(items: WorkItem[], now: number): MovingCard[] {
	const cards: MovingCard[] = [];
	for (const item of items) {
		const next = item.next_action || defaultNext(item.state);
		if (item.state === 'accepted') {
			cards.push({
				workId: item.id,
				title: item.title,
				state: item.state,
				owner: null,
				until: null,
				next,
				detail: 'Accepted. Waiting for release.'
			});
			continue;
		}
		if (!isClaimable(item.state)) continue;
		if (claimActive(item, now)) {
			cards.push({
				workId: item.id,
				title: item.title,
				state: item.state,
				owner: item.claimed_by,
				until: item.claim_until,
				next,
				detail: `Claimed by ${item.claimed_by}.`
			});
			continue;
		}
		const free = availableSince(item, now);
		if (free && now - Date.parse(free) < STALE_HOURS * HOUR) {
			cards.push({
				workId: item.id,
				title: item.title,
				state: item.state,
				owner: null,
				until: null,
				next,
				detail: item.claimed_by
					? `${item.claimed_by}’s claim ran out. Any agent can pick it up.`
					: 'Up for grabs. Any agent can claim it.'
			});
		}
	}
	return cards;
}

async function slippedFor(scope: WorkScope): Promise<SlipCard[]> {
	const since = new Date(Date.now() - 45 * 24 * HOUR).toISOString();
	const { data: events } = await scope.db
		.from('work_events')
		.select('work_id, kind, actor, body, build, created_at')
		.eq('project_id', scope.project.id)
		.in('kind', ['check_failed', 'scope_deferred', 'scope_rejected', 'reopened'])
		.gte('created_at', since)
		.order('created_at', { ascending: false })
		.limit(300);
	const list = (events ?? []) as Pick<WorkEvent, 'work_id' | 'kind' | 'actor' | 'body' | 'build' | 'created_at'>[];
	if (list.length === 0) return [];

	const ids = [...new Set(list.map((event) => event.work_id))].slice(0, 40);
	const { data: rows } = await scope.db
		.from('work_items')
		.select('*')
		.in('id', ids)
		.eq('project_id', scope.project.id);
	const items = new Map(((rows ?? []) as WorkItem[]).map((item) => [item.id, item]));
	const followIds = [...items.values()].map((item) => item.follows_id).filter((id): id is string => Boolean(id));
	const followTitles = new Map<string, string>();
	if (followIds.length) {
		const { data: follows } = await scope.db.from('work_items').select('id, title').in('id', followIds);
		for (const row of follows ?? []) followTitles.set(String(row.id), String(row.title));
	}

	const cards: SlipCard[] = [];
	for (const id of ids) {
		const item = items.get(id);
		if (!item) continue;
		const mine = list.filter((event) => event.work_id === id);
		const failures = mine
			.filter((event) => event.kind === 'check_failed' || event.kind === 'reopened')
			.map((event) => ({ body: event.body, build: event.build, at: event.created_at, actor: event.actor }))
			.reverse();
		const lastFailure = failures.at(-1)?.at ?? '';
		cards.push({
			workId: id,
			title: item.title,
			state: item.state,
			failures,
			fixedBuild:
				item.qa_build && item.qa_passed_at && item.qa_passed_at > lastFailure ? item.qa_build : null,
			deferred: mine
				.filter((event) => event.kind === 'scope_deferred' || event.kind === 'scope_rejected')
				.map((event) => ({
					proposal: event.body,
					status: event.kind === 'scope_deferred' ? 'deferred' : 'rejected'
				})),
			released: item.released_version,
			follows: item.follows_id
				? { id: item.follows_id, title: followTitles.get(item.follows_id) ?? 'Earlier work' }
				: null,
			at: mine[0]?.created_at ?? item.updated_at
		});
	}
	return cards.slice(0, 15);
}

async function openWork(db: SupabaseClient, projectIds: string[]) {
	const [items, decisions] = await Promise.all([
		db
			.from('work_items')
			.select('*')
			.in('project_id', projectIds)
			.in('state', [...OPEN_STATES])
			.order('updated_at', { ascending: false })
			.limit(1000),
		db
			.from('work_decisions')
			.select('*')
			.in('project_id', projectIds)
			.eq('status', 'pending')
			.order('created_at')
			.limit(200)
	]);
	const error = items.error ?? decisions.error;
	return {
		ready: !isMissingTable(error),
		error,
		items: (items.data ?? []) as WorkItem[],
		decisions: (decisions.data ?? []) as WorkDecision[]
	};
}

export async function board(scope: WorkScope): Promise<Board> {
	const open = await openWork(scope.db, [scope.project.id]);
	if (!open.ready) return { ready: false, needsYou: [], moving: [], slipped: [] };
	if (open.error) console.error('board load failed:', open.error.message);
	const now = Date.now();
	return {
		ready: true,
		needsYou: needsFrom(open.items, open.decisions, now),
		moving: movingFrom(open.items, now),
		slipped: await slippedFor(scope)
	};
}

/** "Needs you" across several projects, plus how much is moving in each. */
export async function needsAcross(
	db: SupabaseClient,
	projectIds: string[]
): Promise<{ ready: boolean; needs: NeedCard[]; moving: Map<string, number> }> {
	if (projectIds.length === 0) return { ready: true, needs: [], moving: new Map() };
	const open = await openWork(db, projectIds);
	if (!open.ready) return { ready: false, needs: [], moving: new Map() };
	const now = Date.now();
	const moving = new Map<string, number>();
	for (const card of movingFrom(open.items, now)) {
		const projectId = open.items.find((item) => item.id === card.workId)?.project_id;
		if (projectId) moving.set(projectId, (moving.get(projectId) ?? 0) + 1);
	}
	return { ready: true, needs: needsFrom(open.items, open.decisions, now), moving };
}

// ─── Changing work ───────────────────────────────────────────────────────────

export interface PlanInput {
	title?: unknown;
	outcome?: unknown;
	plan?: unknown;
	acceptance?: unknown;
	base_version?: unknown;
}

function readPlan(input: PlanInput, requireTitle: boolean): Outcome<Partial<WorkItem>> {
	const values: Partial<WorkItem> = {};
	const checks: [keyof PlanInput, string, number][] = [
		['title', 'Title', 200],
		['outcome', 'Outcome', 4000],
		['plan', 'Plan', 20000],
		['acceptance', 'Acceptance criteria', 8000],
		['base_version', 'Base version', 100]
	];
	for (const [name, label, max] of checks) {
		if (!(name in input) || input[name] === undefined) {
			if (name === 'title' && requireTitle) return no(400, 'Title is required.');
			continue;
		}
		const parsed = field(input[name], label, max, name === 'title');
		if (!parsed.ok) return parsed;
		(values as Record<string, string>)[name] = parsed.value;
	}
	return ok(values);
}

async function monthlyRoom(scope: WorkScope): Promise<string | null> {
	const cap = scope.workPerMonth;
	if (!cap) return null;
	const start = new Date();
	start.setUTCDate(1);
	start.setUTCHours(0, 0, 0, 0);
	const { count, error } = await scope.db
		.from('work_items')
		.select('id', { count: 'exact', head: true })
		.eq('project_id', scope.project.id)
		.gte('created_at', start.toISOString());
	if (error) return dbMessage(error);
	if ((count ?? 0) >= cap) {
		return `Monthly limit reached for work items (${cap} per project). Mint ($5 a month) removes it.`;
	}
	return null;
}

export async function createWork(
	scope: WorkScope,
	actor: Actor,
	input: PlanInput & { approve?: boolean; follows_id?: unknown }
): Promise<Outcome<WorkItem>> {
	const plan = readPlan(input, true);
	if (!plan.ok) return plan;
	const approve = input.approve === true;
	if (approve && !actor.person) return no(403, 'Only a person can approve a plan. Create it, and they approve it in Mint.');

	let follows: string | null = null;
	if (input.follows_id !== undefined && input.follows_id !== null && input.follows_id !== '') {
		const parent = await loadWork(scope, String(input.follows_id));
		if (!parent.ok) return no(400, 'follows_id must be work in this project.');
		follows = parent.value.id;
	}

	const full = await monthlyRoom(scope);
	if (full) return no(402, full);

	const now = stamp();
	const { data, error } = await scope.db
		.from('work_items')
		.insert({
			project_id: scope.project.id,
			...plan.value,
			follows_id: follows,
			state: approve ? 'approved' : 'idea',
			approved_by: approve ? actor.name : null,
			approved_at: approve ? now : null,
			available_since: approve ? now : null,
			next_action: defaultNext(approve ? 'approved' : 'idea'),
			created_by: actor.name
		})
		.select('*')
		.single();
	if (error || !data) return no(400, error ? dbMessage(error) : 'Could not create the work.');
	const item = data as WorkItem;

	await record(scope, actor, item, 'created', { body: item.outcome });
	if (approve) await record(scope, actor, item, 'approved');
	else if (!actor.person) {
		await alert(scope, actor, item.id, `Plan waiting for approval: ${item.title}`, `${actor.name} proposed it in ${scope.project.name}.`);
	}
	return ok(item);
}

export async function editPlan(scope: WorkScope, actor: Actor, id: string, input: PlanInput): Promise<Outcome<WorkItem>> {
	const loaded = await loadWork(scope, id);
	if (!loaded.ok) return loaded;
	const item = loaded.value;
	const plan = readPlan(input, false);
	if (!plan.ok) return plan;
	if (Object.keys(plan.value).length === 0) return no(400, 'Include at least one plan field to change.');

	if (item.state === 'idea') {
		const saved = await save(scope, item, plan.value);
		if (saved.ok) await record(scope, actor, saved.value, 'edited', { body: 'Plan updated before approval.' });
		return saved;
	}
	if (!actor.person) {
		return no(409, 'This plan is already approved. Propose a scope change instead of editing it.');
	}
	if (!isClaimable(item.state)) {
		return no(409, 'Work that passed its check can no longer be re-planned. Reopen it or start new work.');
	}
	const saved = await save(scope, item, {
		...plan.value,
		plan_version: item.plan_version + 1,
		state: 'idea',
		approved_by: null,
		approved_at: null,
		available_since: null,
		next_action: defaultNext('idea'),
		...CLEAR_CLAIM
	});
	if (saved.ok) {
		await record(scope, actor, saved.value, 'edited', {
			body: `Plan changed to version ${saved.value.plan_version}. It needs approval again, and any claim was released.`
		});
	}
	return saved;
}

export async function approveWork(scope: WorkScope, actor: Actor, id: string): Promise<Outcome<WorkItem>> {
	if (!actor.person) return no(403, 'Only a person can approve a plan.');
	const loaded = await loadWork(scope, id);
	if (!loaded.ok) return loaded;
	const item = loaded.value;
	if (item.state !== 'idea') return no(409, 'Only work waiting for approval can be approved.');
	const now = stamp();
	const saved = await save(scope, item, {
		state: 'approved',
		approved_by: actor.name,
		approved_at: now,
		available_since: now,
		next_action: defaultNext('approved')
	});
	if (saved.ok) await record(scope, actor, saved.value, 'approved', { body: `Approved plan version ${saved.value.plan_version}.` });
	return saved;
}

export async function claimWork(
	scope: WorkScope,
	actor: Actor,
	id: string,
	input: { hours?: unknown; next_action?: unknown } = {}
): Promise<Outcome<WorkItem>> {
	const loaded = await loadWork(scope, id);
	if (!loaded.ok) return loaded;
	const item = loaded.value;
	if (!isClaimable(item.state)) {
		return no(409, item.state === 'idea' ? 'This plan is not approved yet, so it cannot be claimed.' : 'This work is not open for a claim.');
	}
	const hours = input.hours === undefined || input.hours === '' ? CLAIM_HOURS : Number(input.hours);
	if (!Number.isFinite(hours) || hours < 1 || hours > MAX_CLAIM_HOURS) {
		return no(400, `hours must be a number from 1 to ${MAX_CLAIM_HOURS}.`);
	}
	const next = field(input.next_action, 'next_action', 500);
	if (!next.ok) return next;

	const now = Date.now();
	const mine = item.claimed_by === actor.name;
	if (claimActive(item, now) && !mine) {
		return no(409, `Already claimed by ${item.claimed_by} until ${item.claim_until}. Do not start a duplicate.`);
	}
	const saved = await save(scope, item, {
		state: 'in_progress',
		claimed_by: actor.name,
		claimed_at: mine && claimActive(item, now) ? item.claimed_at : new Date(now).toISOString(),
		claim_until: new Date(now + hours * HOUR).toISOString(),
		available_since: null,
		next_action:
			next.value ||
			(item.next_action && !isDefaultNext(item.next_action) ? item.next_action : defaultNext('in_progress'))
	});
	if (saved.ok && !(mine && claimActive(item, now))) {
		await record(scope, actor, saved.value, 'claimed', {
			body: item.state === 'check_failed' ? 'Picked up the fix for the failed check.' : ''
		});
	}
	return saved;
}

export async function handOff(
	scope: WorkScope,
	actor: Actor,
	id: string,
	input: { note?: unknown; next_action?: unknown }
): Promise<Outcome<WorkItem>> {
	const loaded = await loadWork(scope, id);
	if (!loaded.ok) return loaded;
	const item = loaded.value;
	if (!item.claimed_by) return no(409, 'Nobody holds this work, so there is nothing to hand off.');
	if (item.claimed_by !== actor.name && !actor.person && claimActive(item)) {
		return no(403, `Only ${item.claimed_by} or a person can hand this off.`);
	}
	const note = field(input.note, 'note', 8000);
	if (!note.ok) return note;
	const next = field(input.next_action, 'next_action', 500);
	if (!next.ok) return next;
	const saved = await save(scope, item, {
		...CLEAR_CLAIM,
		available_since: stamp(),
		next_action: next.value || item.next_action
	});
	if (saved.ok) await record(scope, actor, saved.value, 'handed_off', { body: note.value });
	return saved;
}

export async function addNote(
	scope: WorkScope,
	actor: Actor,
	id: string,
	input: { body?: unknown; next_action?: unknown }
): Promise<Outcome<WorkItem>> {
	const loaded = await loadWork(scope, id);
	if (!loaded.ok) return loaded;
	const item = loaded.value;
	const body = field(input.body, 'body', 8000, true);
	if (!body.ok) return body;
	const next = field(input.next_action, 'next_action', 500);
	if (!next.ok) return next;
	const patch: Partial<WorkItem> = {};
	if (next.value) patch.next_action = next.value;
	if (item.claimed_by === actor.name && claimActive(item)) {
		patch.claim_until = new Date(Date.now() + CLAIM_HOURS * HOUR).toISOString();
	}
	const saved = await save(scope, item, patch);
	if (saved.ok) await record(scope, actor, saved.value, 'note', { body: body.value });
	return saved;
}

export async function postCheck(
	scope: WorkScope,
	actor: Actor,
	id: string,
	input: { result?: unknown; body?: unknown; build?: unknown }
): Promise<Outcome<WorkItem>> {
	const loaded = await loadWork(scope, id);
	if (!loaded.ok) return loaded;
	const item = loaded.value;
	if (input.result !== 'failed' && input.result !== 'passed') return no(400, 'result must be "failed" or "passed".');
	const build = field(input.build, 'build', 200, true);
	if (!build.ok) return build;
	const body = field(input.body, 'body', 8000, input.result === 'failed');
	if (!body.ok) return body;

	if (input.result === 'failed') {
		if (!['in_progress', 'check_failed', 'qa_passed', 'accepted'].includes(item.state)) {
			return no(409, 'Checks can be posted only on work that is in progress, failed, or passed.');
		}
		const saved = await save(scope, item, {
			state: 'check_failed',
			...CLEAR_CLAIM,
			available_since: stamp(),
			qa_build: null,
			qa_passed_at: null,
			accepted_by: null,
			accepted_at: null,
			next_action: `Fix: ${body.value}`.slice(0, 500)
		});
		if (saved.ok) await record(scope, actor, saved.value, 'check_failed', { body: body.value, build: build.value });
		return saved;
	}

	if (item.state !== 'in_progress' && item.state !== 'check_failed') {
		return no(409, 'A passing check can be posted only on work that is in progress or failed.');
	}
	const saved = await save(scope, item, {
		state: 'qa_passed',
		...CLEAR_CLAIM,
		available_since: null,
		qa_build: build.value,
		qa_passed_at: stamp(),
		next_action: defaultNext('qa_passed')
	});
	if (saved.ok) {
		await record(scope, actor, saved.value, 'check_passed', { body: body.value, build: build.value });
		await alert(scope, actor, item.id, `Ready to accept: ${item.title}`, `The check passed on build ${build.value}.`);
	}
	return saved;
}

export async function proposeScope(
	scope: WorkScope,
	actor: Actor,
	id: string,
	input: { proposal?: unknown; reason?: unknown }
): Promise<Outcome<WorkDecision>> {
	const loaded = await loadWork(scope, id);
	if (!loaded.ok) return loaded;
	const item = loaded.value;
	if (item.state === 'released' || item.state === 'dropped') {
		return no(409, 'This work is closed. Reopen it or start new work instead.');
	}
	const proposal = field(input.proposal, 'proposal', 4000, true);
	if (!proposal.ok) return proposal;
	const reason = field(input.reason, 'reason', 4000);
	if (!reason.ok) return reason;
	const { data, error } = await scope.db
		.from('work_decisions')
		.insert({
			work_id: item.id,
			project_id: scope.project.id,
			proposal: proposal.value,
			reason: reason.value,
			proposed_by: actor.name
		})
		.select('*')
		.single();
	if (error || !data) return no(400, error ? dbMessage(error) : 'Could not save the proposal.');
	await record(scope, actor, item, 'scope_proposed', { body: proposal.value });
	await alert(scope, actor, item.id, `Scope change to decide: ${item.title}`, `${actor.name} proposed: ${proposal.value}`);
	return ok(data as WorkDecision);
}

export async function decideScope(
	scope: WorkScope,
	actor: Actor,
	decisionId: string,
	input: { status?: unknown; note?: unknown }
): Promise<Outcome<WorkDecision>> {
	if (!actor.person) return no(403, 'Only a person can decide a scope change.');
	if (!isUuid(decisionId)) return no(404, 'That decision is not in this project.');
	const status = input.status;
	if (status !== 'approved' && status !== 'deferred' && status !== 'rejected') {
		return no(400, 'Choose approve, defer or reject.');
	}
	const note = field(input.note, 'note', 2000);
	if (!note.ok) return note;
	const { data: found, error: findError } = await scope.db
		.from('work_decisions')
		.select('*')
		.eq('id', decisionId)
		.eq('project_id', scope.project.id)
		.maybeSingle();
	if (findError) return no(500, dbMessage(findError));
	const decision = found as WorkDecision | null;
	if (!decision) return no(404, 'That decision is not in this project.');
	if (decision.status !== 'pending') return no(409, 'This scope change was already decided.');
	const loaded = await loadWork(scope, decision.work_id);
	if (!loaded.ok) return loaded;
	const original = loaded.value;

	let resultWorkId: string | null = null;
	if (status === 'approved') {
		const firstLine = decision.proposal.split('\n')[0]?.trim() || decision.proposal;
		const now = stamp();
		const { data: created, error: createError } = await scope.db
			.from('work_items')
			.insert({
				project_id: scope.project.id,
				title: firstLine.slice(0, 200),
				outcome: decision.proposal,
				plan: decision.reason,
				follows_id: original.id,
				state: 'approved',
				approved_by: actor.name,
				approved_at: now,
				available_since: now,
				next_action: defaultNext('approved'),
				created_by: decision.proposed_by || actor.name
			})
			.select('*')
			.single();
		if (createError || !created) return no(400, createError ? dbMessage(createError) : 'Could not create the new work.');
		resultWorkId = String(created.id);
		await record(scope, actor, created as WorkItem, 'created', {
			body: `Split out of “${original.title}” as an approved scope change.`
		});
		await record(scope, actor, created as WorkItem, 'approved');
	}

	const { data: updated, error: updateError } = await scope.db
		.from('work_decisions')
		.update({
			status,
			decided_by: actor.name,
			decided_at: stamp(),
			note: note.value,
			result_work_id: resultWorkId
		})
		.eq('id', decision.id)
		.eq('status', 'pending')
		.select('*')
		.maybeSingle();
	if (updateError) return no(400, dbMessage(updateError));
	if (!updated) return no(409, 'This scope change was already decided.');
	await record(scope, actor, original, `scope_${status}`, {
		body: note.value ? `${decision.proposal}\n\n${note.value}` : decision.proposal
	});
	return ok(updated as WorkDecision);
}

export async function acceptWork(scope: WorkScope, actor: Actor, id: string): Promise<Outcome<WorkItem>> {
	if (!actor.person) return no(403, 'Only a person can accept work.');
	const loaded = await loadWork(scope, id);
	if (!loaded.ok) return loaded;
	const item = loaded.value;
	if (item.state !== 'qa_passed') return no(409, 'Only work whose check passed can be accepted.');
	const saved = await save(scope, item, {
		state: 'accepted',
		accepted_by: actor.name,
		accepted_at: stamp(),
		next_action: defaultNext('accepted')
	});
	if (saved.ok) await record(scope, actor, saved.value, 'accepted', { build: item.qa_build ?? '' });
	return saved;
}

export async function releaseWork(
	scope: WorkScope,
	actor: Actor,
	id: string,
	input: { version?: unknown; note?: unknown }
): Promise<Outcome<WorkItem>> {
	const loaded = await loadWork(scope, id);
	if (!loaded.ok) return loaded;
	const item = loaded.value;
	if (item.state !== 'accepted') return no(409, 'Only accepted work can be released. A person accepts it first.');
	const version = field(input.version, 'version', 100, true);
	if (!version.ok) return version;
	const note = field(input.note, 'note', 8000);
	if (!note.ok) return note;
	const saved = await save(scope, item, {
		state: 'released',
		released_version: version.value,
		released_at: stamp(),
		next_action: ''
	});
	if (saved.ok) await record(scope, actor, saved.value, 'released', { body: note.value, build: version.value });
	return saved;
}

export async function reopenWork(
	scope: WorkScope,
	actor: Actor,
	id: string,
	input: { body?: unknown; build?: unknown }
): Promise<Outcome<WorkItem>> {
	const loaded = await loadWork(scope, id);
	if (!loaded.ok) return loaded;
	const item = loaded.value;
	if (item.state !== 'released' && item.state !== 'accepted') {
		return no(409, 'Only accepted or released work can be reopened. Post a failed check instead.');
	}
	const body = field(input.body, 'body', 4000, true);
	if (!body.ok) return body;
	const build = field(input.build, 'build', 200);
	if (!build.ok) return build;

	const full = await monthlyRoom(scope);
	if (full) return no(402, full);

	const { data, error } = await scope.db
		.from('work_items')
		.insert({
			project_id: scope.project.id,
			title: `Again: ${item.title}`.slice(0, 200),
			outcome: `${body.value}\n\nSeen after ${item.released_version ? `release ${item.released_version}` : 'acceptance'} of “${item.title}”.`.slice(0, 4000),
			plan: item.plan,
			acceptance: item.acceptance,
			base_version: item.released_version ?? item.base_version,
			follows_id: item.id,
			state: 'idea',
			next_action: defaultNext('idea'),
			created_by: actor.name
		})
		.select('*')
		.single();
	if (error || !data) return no(400, error ? dbMessage(error) : 'Could not open the follow-up.');
	const next = data as WorkItem;
	await record(scope, actor, item, 'reopened', { body: body.value, build: build.value });
	await record(scope, actor, next, 'created', { body: `Follows “${item.title}”, which failed again: ${body.value}` });
	await alert(scope, actor, next.id, `Seen again after release: ${item.title}`, body.value);
	return ok(next);
}

export async function dropWork(
	scope: WorkScope,
	actor: Actor,
	id: string,
	input: { note?: unknown } = {}
): Promise<Outcome<WorkItem>> {
	if (!actor.person) return no(403, 'Only a person can drop work.');
	const loaded = await loadWork(scope, id);
	if (!loaded.ok) return loaded;
	const item = loaded.value;
	if (item.state === 'released' || item.state === 'dropped') return no(409, 'This work is already closed.');
	const note = field(input.note, 'note', 2000);
	if (!note.ok) return note;
	const saved = await save(scope, item, { state: 'dropped', ...CLEAR_CLAIM, available_since: null, next_action: '' });
	if (saved.ok) await record(scope, actor, saved.value, 'dropped', { body: note.value });
	return saved;
}

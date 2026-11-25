import type { RequestEvent } from '@sveltejs/kit';
import { WORK_STATES } from '#lib/constants.ts';
import { authenticate, fail, pageOf, readJson, reply, type ApiContext } from './public-api.ts';
import {
	addNote,
	board,
	claimWork,
	createWork,
	editPlan,
	handOff,
	listWork,
	postCheck,
	proposeScope,
	releaseWork,
	reopenWork,
	workDetail,
	type Board,
	type Outcome,
	type WorkItem
} from './work.ts';

const STATE_IDS = WORK_STATES.map((state) => state.value) as string[];

const PERSON_ONLY: Record<string, string> = {
	approve: 'approves the plan',
	accept: 'accepts the work',
	drop: 'drops the work',
	decide: 'decides scope changes'
};

function workUrl(event: RequestEvent, ctx: ApiContext, id: string): string {
	return `${event.url.origin}/dashboard/projects/${ctx.project.id}/work/${id}`;
}

function withUrl(event: RequestEvent, ctx: ApiContext, item: WorkItem) {
	return { ...item, url: workUrl(event, ctx, item.id) };
}

function send<T>(outcome: Outcome<T>, shape: (value: T) => unknown, status = 200): Response {
	if (!outcome.ok) return fail(outcome.status, outcome.error);
	return reply({ data: shape(outcome.value) }, status);
}

function boardPayload(event: RequestEvent, ctx: ApiContext, value: Board) {
	return {
		needs_you: value.needsYou.map((card) => ({
			kind: card.kind,
			work_id: card.workId,
			decision_id: card.decisionId ?? null,
			title: card.title,
			detail: card.detail,
			since: card.since,
			url: workUrl(event, ctx, card.workId)
		})),
		moving: value.moving.map((card) => ({
			work_id: card.workId,
			title: card.title,
			state: card.state,
			claimed_by: card.owner,
			claim_until: card.until,
			next_action: card.next,
			detail: card.detail,
			url: workUrl(event, ctx, card.workId)
		})),
		slipped: value.slipped.map((card) => ({
			work_id: card.workId,
			title: card.title,
			state: card.state,
			failures: card.failures,
			fixed_build: card.fixedBuild,
			deferred: card.deferred,
			released_version: card.released,
			follows: card.follows,
			at: card.at,
			url: workUrl(event, ctx, card.workId)
		}))
	};
}

export async function handleBoard(event: RequestEvent): Promise<Response> {
	const ctx = await authenticate(event);
	if (ctx instanceof Response) return ctx;
	if (event.request.method !== 'GET') return fail(405, 'Use GET on /api/v1/board.');
	const value = await board(ctx.work);
	if (!value.ready) return fail(503, 'The work loop is not set up on this server yet. Ask the owner to apply the latest migration.');
	return reply({ data: boardPayload(event, ctx, value) });
}

export async function handleWorkList(event: RequestEvent): Promise<Response> {
	const ctx = await authenticate(event);
	if (ctx instanceof Response) return ctx;

	if (event.request.method === 'GET') {
		const page = pageOf(event.url);
		if ('error' in page) return fail(400, page.error);
		const state = event.url.searchParams.get('state') ?? '';
		if (state && !STATE_IDS.includes(state)) return fail(400, `state must be one of: ${STATE_IDS.join(', ')}.`);
		const open = event.url.searchParams.get('open') === 'true';
		const listed = await listWork(ctx.work, { state: state || undefined, open, ...page });
		if (!listed.ok) return fail(listed.status, listed.error);
		return reply({
			data: listed.value.items.map((item) => withUrl(event, ctx, item)),
			count: listed.value.count,
			limit: page.limit,
			offset: page.offset
		});
	}

	if (event.request.method !== 'POST') return fail(405, 'Use GET or POST on /api/v1/work.');
	const body = await readJson(event.request);
	if ('error' in body) return fail(400, body.error);
	if (body.value.approve === true) {
		return fail(403, 'Only a person approves a plan. Create the work without approve, then ask them to approve it in Mint.');
	}
	const created = await createWork(ctx.work, ctx.agent, body.value);
	return send(created, (item) => withUrl(event, ctx, item), 201);
}

export async function handleWorkItem(event: RequestEvent): Promise<Response> {
	const ctx = await authenticate(event);
	if (ctx instanceof Response) return ctx;
	const id = event.params.id ?? '';

	if (event.request.method === 'GET') {
		const detail = await workDetail(ctx.work, id);
		return send(detail, (value) => ({
			...withUrl(event, ctx, value.item),
			events: value.events,
			decisions: value.decisions,
			follows: value.follows,
			follow_ups: value.followUps
		}));
	}

	if (event.request.method !== 'PATCH') return fail(405, 'Use GET or PATCH on this work.');
	const body = await readJson(event.request);
	if ('error' in body) return fail(400, body.error);
	const edited = await editPlan(ctx.work, ctx.agent, id, body.value);
	return send(edited, (item) => withUrl(event, ctx, item));
}

export async function handleWorkAction(event: RequestEvent): Promise<Response> {
	const ctx = await authenticate(event);
	if (ctx instanceof Response) return ctx;
	if (event.request.method !== 'POST') return fail(405, 'Use POST for work actions.');
	const id = event.params.id ?? '';
	const action = event.params.action ?? '';

	if (action in PERSON_ONLY) {
		return fail(
			403,
			`Only a person ${PERSON_ONLY[action]}. Ask them to do it in Mint: ${workUrl(event, ctx, id)}`
		);
	}

	const body = await readJson(event.request);
	if ('error' in body) return fail(400, body.error);
	const input = body.value;
	const shape = (item: WorkItem) => withUrl(event, ctx, item);

	switch (action) {
		case 'claim':
			return send(await claimWork(ctx.work, ctx.agent, id, input), shape);
		case 'handoff':
			return send(await handOff(ctx.work, ctx.agent, id, input), shape);
		case 'notes':
			return send(await addNote(ctx.work, ctx.agent, id, input), shape, 201);
		case 'checks':
			return send(await postCheck(ctx.work, ctx.agent, id, input), shape, 201);
		case 'scope':
			return send(await proposeScope(ctx.work, ctx.agent, id, input), (decision) => decision, 201);
		case 'release':
			return send(await releaseWork(ctx.work, ctx.agent, id, input), shape);
		case 'reopen':
			return send(await reopenWork(ctx.work, ctx.agent, id, input), shape, 201);
		default:
			return fail(
				404,
				'Unknown action. Use claim, handoff, notes, checks, scope, release or reopen. A person approves, accepts, decides and drops.'
			);
	}
}

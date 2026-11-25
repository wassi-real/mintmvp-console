import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { displayName, projectContext, type ProjectContext } from './context.ts';
import {
	acceptWork,
	addNote,
	approveWork,
	createWork,
	decideScope,
	dropWork,
	editPlan,
	handOff,
	postCheck,
	proposeScope,
	releaseWork,
	reopenWork,
	type Actor,
	type Outcome,
	type WorkScope
} from './work.ts';

export function appScope(context: ProjectContext): { scope: WorkScope; actor: Actor } {
	return {
		scope: {
			db: context.supabase,
			project: { id: context.project.id, organization_id: context.project.organization_id, name: context.project.name }
		},
		actor: { name: displayName(context.profile), userId: context.profile.id, via: 'app', person: true }
	};
}

async function prepare(event: RequestEvent) {
	const context = await projectContext(event);
	if (!context.canEdit) return { denied: fail(403, { message: 'View-only members cannot change work.' }) };
	const form = await event.request.formData();
	const value = (name: string) => {
		const raw = form.get(name);
		return typeof raw === 'string' ? raw : undefined;
	};
	return { context, form, value, ...appScope(context) };
}

function done<T>(outcome: Outcome<T>, message: string) {
	if (!outcome.ok) return fail(outcome.status, { message: outcome.error });
	return { message };
}

function workPath(context: ProjectContext, id: string): string {
	return `/dashboard/projects/${context.project.id}/work/${id}`;
}

export const workActions = {
	create: async (event: RequestEvent) => {
		const ready = await prepare(event);
		if ('denied' in ready) return ready.denied;
		const { value, scope, actor, context } = ready;
		const created = await createWork(scope, actor, {
			title: value('title'),
			outcome: value('outcome'),
			plan: value('plan'),
			acceptance: value('acceptance'),
			base_version: value('base_version'),
			approve: value('approve') === 'on'
		});
		if (!created.ok) return fail(created.status, { message: created.error });
		redirect(303, workPath(context, created.value.id));
	},

	edit: async (event: RequestEvent) => {
		const ready = await prepare(event);
		if ('denied' in ready) return ready.denied;
		const { value, scope, actor } = ready;
		const edited = await editPlan(scope, actor, value('id') ?? '', {
			title: value('title'),
			outcome: value('outcome'),
			plan: value('plan'),
			acceptance: value('acceptance'),
			base_version: value('base_version')
		});
		return done(
			edited,
			edited.ok && edited.value.state === 'idea' && edited.value.plan_version > 1
				? `Saved as plan version ${edited.value.plan_version}. Approve it again to let agents continue.`
				: 'Plan saved.'
		);
	},

	approve: async (event: RequestEvent) => {
		const ready = await prepare(event);
		if ('denied' in ready) return ready.denied;
		return done(await approveWork(ready.scope, ready.actor, ready.value('id') ?? ''), 'Approved. Agents can pick it up now.');
	},

	decide: async (event: RequestEvent) => {
		const ready = await prepare(event);
		if ('denied' in ready) return ready.denied;
		const status = ready.value('status');
		const decided = await decideScope(ready.scope, ready.actor, ready.value('decision') ?? '', {
			status,
			note: ready.value('note')
		});
		const words: Record<string, string> = {
			approved: 'Approved. It is now its own piece of work.',
			deferred: 'Deferred. It stays on record.',
			rejected: 'Rejected.'
		};
		return done(decided, words[status ?? ''] ?? 'Decided.');
	},

	accept: async (event: RequestEvent) => {
		const ready = await prepare(event);
		if ('denied' in ready) return ready.denied;
		return done(await acceptWork(ready.scope, ready.actor, ready.value('id') ?? ''), 'Accepted. It can be released now.');
	},

	check: async (event: RequestEvent) => {
		const ready = await prepare(event);
		if ('denied' in ready) return ready.denied;
		const result = ready.value('result');
		const posted = await postCheck(ready.scope, ready.actor, ready.value('id') ?? '', {
			result,
			build: ready.value('build'),
			body: ready.value('body')
		});
		return done(posted, result === 'passed' ? 'Check passed. Accept it when you are happy.' : 'Failed check recorded. It is back in the queue.');
	},

	scope: async (event: RequestEvent) => {
		const ready = await prepare(event);
		if ('denied' in ready) return ready.denied;
		const proposed = await proposeScope(ready.scope, ready.actor, ready.value('id') ?? '', {
			proposal: ready.value('proposal'),
			reason: ready.value('reason')
		});
		return done(proposed, 'Scope change recorded. Decide it below.');
	},

	release: async (event: RequestEvent) => {
		const ready = await prepare(event);
		if ('denied' in ready) return ready.denied;
		const released = await releaseWork(ready.scope, ready.actor, ready.value('id') ?? '', {
			version: ready.value('version'),
			note: ready.value('note')
		});
		return done(released, 'Released.');
	},

	reopen: async (event: RequestEvent) => {
		const ready = await prepare(event);
		if ('denied' in ready) return ready.denied;
		const reopened = await reopenWork(ready.scope, ready.actor, ready.value('id') ?? '', {
			body: ready.value('body'),
			build: ready.value('build')
		});
		if (!reopened.ok) return fail(reopened.status, { message: reopened.error });
		redirect(303, workPath(ready.context, reopened.value.id));
	},

	handoff: async (event: RequestEvent) => {
		const ready = await prepare(event);
		if ('denied' in ready) return ready.denied;
		const released = await handOff(ready.scope, ready.actor, ready.value('id') ?? '', {
			note: ready.value('note') ?? 'Claim released from Mint.',
			next_action: ready.value('next_action')
		});
		return done(released, 'Claim released. Any agent can pick it up.');
	},

	note: async (event: RequestEvent) => {
		const ready = await prepare(event);
		if ('denied' in ready) return ready.denied;
		const noted = await addNote(ready.scope, ready.actor, ready.value('id') ?? '', {
			body: ready.value('body'),
			next_action: ready.value('next_action')
		});
		return done(noted, 'Note added.');
	},

	drop: async (event: RequestEvent) => {
		const ready = await prepare(event);
		if ('denied' in ready) return ready.denied;
		return done(
			await dropWork(ready.scope, ready.actor, ready.value('id') ?? '', { note: ready.value('note') }),
			'Dropped.'
		);
	}
};

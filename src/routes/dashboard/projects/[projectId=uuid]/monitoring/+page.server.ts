import { fail } from '@sveltejs/kit';
import { monitoringTargetFields } from '#lib/sections.ts';
import { logActivity } from '#lib/server/activity.ts';
import { projectContext, type ProjectContext } from '#lib/server/context.ts';
import { crudActions, dbMessage, VIEW_ONLY } from '#lib/server/crud.ts';
import { probe } from '#lib/server/monitoring.ts';
import { isUuid, text } from '#lib/server/validate.ts';
import type { Actions, PageServerLoad } from './$types';

async function targetsOf(context: ProjectContext) {
	const { data } = await context.supabase
		.from('monitoring_targets')
		.select('*')
		.eq('project_id', context.project.id)
		.order('sort_order')
		.order('created_at');
	return data ?? [];
}

export const load: PageServerLoad = async (event) => {
	const context = await projectContext(event);
	const targets = await targetsOf(context);

	const ids = targets.map((target) => target.id);
	const { data: runs } = ids.length
		? await context.supabase
				.from('monitoring_check_runs')
				.select('id, target_id, checked_at, ok, http_status, duration_ms, error_message')
				.in('target_id', ids)
				.order('checked_at', { ascending: false })
				.limit(300)
		: { data: [] };

	const latest = new Map<string, NonNullable<typeof runs>[number]>();
	for (const run of runs ?? []) {
		if (!latest.has(run.target_id)) latest.set(run.target_id, run);
	}

	const { data: health } = await context.supabase
		.from('project_health')
		.select('uptime_status, last_check_at, error_count, warning_count')
		.eq('project_id', context.project.id)
		.maybeSingle();

	return {
		targets: targets.map((target) => ({ ...target, latest: latest.get(target.id) ?? null })),
		runs: (runs ?? []).slice(0, 100),
		health
	};
};

/** Checks every enabled address and refreshes the project's health summary. */
async function checkTargets(context: ProjectContext, onlyId?: string) {
	const targets = (await targetsOf(context)).filter(
		(target) => target.enabled && (!onlyId || target.id === onlyId)
	);
	if (targets.length === 0) return { checked: 0, failed: 0 };

	const results = await Promise.all(
		targets.map(async (target) => ({ target, result: await probe(target.url) }))
	);

	const { error } = await context.supabase.from('monitoring_check_runs').insert(
		results.map(({ target, result }) => ({
			target_id: target.id,
			ok: result.ok,
			http_status: result.httpStatus,
			duration_ms: result.durationMs,
			error_message: result.errorMessage
		}))
	);
	if (error) return { error: dbMessage(error, 'check') };

	// The summary covers all enabled addresses, using the result we just got or the last known one.
	const all = await targetsOf(context);
	const enabled = all.filter((target) => target.enabled);
	const fresh = new Map(results.map(({ target, result }) => [target.id, result.ok]));
	const unknown = enabled.filter((target) => !fresh.has(target.id));
	if (unknown.length) {
		const { data: previous } = await context.supabase
			.from('monitoring_check_runs')
			.select('target_id, ok')
			.in(
				'target_id',
				unknown.map((target) => target.id)
			)
			.order('checked_at', { ascending: false })
			.limit(500);
		for (const run of previous ?? []) {
			if (!fresh.has(run.target_id)) fresh.set(run.target_id, run.ok);
		}
	}

	const failing = enabled.filter((target) => fresh.get(target.id) === false).length;
	const unchecked = enabled.filter((target) => !fresh.has(target.id)).length;
	const uptime =
		enabled.length === 0 || unchecked === enabled.length
			? 'unknown'
			: failing === 0
				? 'up'
				: failing === enabled.length - unchecked
					? 'down'
					: 'degraded';

	await context.supabase.from('project_health').upsert(
		{
			project_id: context.project.id,
			uptime_status: uptime,
			last_check_at: new Date().toISOString(),
			error_count: failing,
			warning_count: unchecked
		},
		{ onConflict: 'project_id' }
	);

	const failed = results.filter(({ result }) => !result.ok).length;
	await logActivity(
		context,
		`Uptime check: ${results.length - failed} of ${results.length} addresses responded`
	);
	return { checked: results.length, failed };
}

export const actions: Actions = {
	...crudActions({
		table: 'monitoring_targets',
		fields: monitoringTargetFields,
		noun: 'address',
		titleField: 'name'
	}),

	check: async (event) => {
		const context = await projectContext(event);
		if (!context.canEdit) return fail(403, { message: VIEW_ONLY });
		const id = text(await event.request.formData(), 'id');
		if (id && !isUuid(id)) return fail(400, { message: 'That address could not be found.' });

		const outcome = await checkTargets(context, id || undefined);
		if ('error' in outcome) return fail(400, { message: outcome.error });
		if (outcome.checked === 0) {
			return fail(400, { message: 'There are no enabled addresses to check.' });
		}
		return {
			message:
				outcome.failed === 0
					? `All ${outcome.checked} addresses responded.`
					: `${outcome.failed} of ${outcome.checked} addresses had a problem.`
		};
	}
};

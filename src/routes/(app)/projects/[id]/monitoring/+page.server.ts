import type { PageServerLoad, Actions } from './$types';
import type { Tables } from '$lib/supabase/types';
import { fail } from '@sveltejs/kit';
import { logActivity, getActorName } from '$lib/server/activity';
import { createServiceRoleClient } from '$lib/supabase/server';
import { isProjectStaff } from '$lib/server/roles';
import { newPublicMonitoringToken } from '$lib/server/public-monitoring';
import { runMonitoringChecks } from '$lib/server/monitoring-checks';

export const load: PageServerLoad = async ({ locals, params, url }) => {
	let { data: health } = await locals.supabase
		.from('project_health')
		.select('*')
		.eq('project_id', params.id)
		.maybeSingle();

	if (!health) {
		const { data: row } = await (locals.supabase.from('project_health') as any)
			.insert({ project_id: params.id })
			.select()
			.single();
		health = row;
	}

	const { data: incidents } = await locals.supabase
		.from('incidents')
		.select('id, status')
		.eq('project_id', params.id);

	const { data: monitoringTargets } = await locals.supabase
		.from('monitoring_targets')
		.select('*')
		.eq('project_id', params.id)
		.order('sort_order')
		.order('name');

	const targetIds = (monitoringTargets ?? []).map((t: any) => t.id as string);
	let recentRuns: Tables<'monitoring_check_runs'>[] = [];
	if (targetIds.length) {
		const { data: runs } = await locals.supabase
			.from('monitoring_check_runs')
			.select('*')
			.in('target_id', targetIds)
			.order('checked_at', { ascending: false })
			.limit(80);
		recentRuns = (runs ?? []) as Tables<'monitoring_check_runs'>[];
	}

	const { data: deploymentObs } = await locals.supabase
		.from('deployment_observations')
		.select('*')
		.eq('project_id', params.id)
		.order('observed_at', { ascending: false })
		.limit(40);

	const canManagePublicMonitoring =
		locals.session?.user?.id != null &&
		(await isProjectStaff(locals.supabase, locals.session.user.id));

	let publicStatusPage: { url: string; isEnabled: boolean } | null = null;
	if (canManagePublicMonitoring) {
		const { data: link } = await locals.supabase
			.from('project_monitoring_public')
			.select('token, is_enabled')
			.eq('project_id', params.id)
			.maybeSingle();
		const row = link as { token: string; is_enabled: boolean } | null;
		if (row?.token) {
			publicStatusPage = {
				url: `${url.origin}/status/${row.token}`,
				isEnabled: Boolean(row.is_enabled)
			};
		}
	}

	const canManageTargets =
		locals.session?.user?.id != null && (await isProjectStaff(locals.supabase, locals.session.user.id));

	return {
		health: health as Tables<'project_health'> | null,
		openIncidents: (incidents ?? []).filter((i: any) => i.status === 'open').length,
		totalIncidents: (incidents ?? []).length,
		canManagePublicMonitoring,
		publicStatusPage,
		monitoringTargets: (monitoringTargets ?? []) as Tables<'monitoring_targets'>[],
		recentRuns,
		deploymentObservations: (deploymentObs ?? []) as Tables<'deployment_observations'>[],
		canManageTargets
	};
};

function requireSession(locals: { session: { user: { id: string } } | null }) {
	if (!locals.session?.user?.id) return fail(401, { error: 'Unauthorized' });
	return null;
}

export const actions: Actions = {
	update: async ({ request, locals, params }) => {
		const gate = requireSession(locals);
		if (gate) return gate;
		if (!(await isProjectStaff(locals.supabase, locals.session!.user.id))) {
			return fail(403, { error: 'Only owners and developers can update health.' });
		}

		const form = await request.formData();
		const id = form.get('id') as string;
		const uptime_status = (form.get('uptime_status') as string) || 'unknown';
		const error_count = parseInt(form.get('error_count') as string) || 0;
		const warning_count = parseInt(form.get('warning_count') as string) || 0;

		if (!id) return fail(400, { error: 'ID is required' });

		const { error } = await (locals.supabase.from('project_health') as any)
			.update({
				uptime_status,
				error_count,
				warning_count,
				last_check_at: new Date().toISOString()
			})
			.eq('id', id);

		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, `Health status updated: ${uptime_status}`, getActorName(locals.session!));
		return { success: true };
	},

	publishPublic: async ({ request, locals, params }) => {
		const gate = requireSession(locals);
		if (gate) return gate;
		if (!(await isProjectStaff(locals.supabase, locals.session!.user.id))) {
			return fail(403, { error: 'Forbidden' });
		}

		let admin: ReturnType<typeof createServiceRoleClient>;
		try {
			admin = createServiceRoleClient();
		} catch (e) {
			return fail(500, {
				error: e instanceof Error ? e.message : 'SUPABASE_SERVICE_ROLE_KEY is required for public status.'
			});
		}

		const origin = new URL(request.url).origin;
		const now = new Date().toISOString();

		const { data: existing } = await (admin.from('project_monitoring_public') as any)
			.select('token, is_enabled')
			.eq('project_id', params.id)
			.maybeSingle();

		const row = existing as { token: string; is_enabled: boolean } | null;

		if (row?.is_enabled) {
			return {
				success: true,
				publicUrl: `${origin}/status/${row.token}`,
				alreadyLive: true
			};
		}

		if (!row) {
			const token = newPublicMonitoringToken();
			const { error } = await (admin.from('project_monitoring_public') as any).insert({
				project_id: params.id,
				token,
				is_enabled: true,
				created_at: now,
				updated_at: now
			});
			if (error) return fail(500, { error: error.message });
			await logActivity(
				locals.supabase,
				params.id,
				'Public monitoring status page published',
				getActorName(locals.session!)
			);
			return { success: true, publicUrl: `${origin}/status/${token}` };
		}

		const { error } = await (admin.from('project_monitoring_public') as any)
			.update({ is_enabled: true, updated_at: now })
			.eq('project_id', params.id);
		if (error) return fail(500, { error: error.message });
		await logActivity(
			locals.supabase,
			params.id,
			'Public monitoring status page re-enabled',
			getActorName(locals.session!)
		);
		return { success: true, publicUrl: `${origin}/status/${row.token}` };
	},

	unpublishPublic: async ({ locals, params }) => {
		const gate = requireSession(locals);
		if (gate) return gate;
		if (!(await isProjectStaff(locals.supabase, locals.session!.user.id))) {
			return fail(403, { error: 'Forbidden' });
		}

		let admin: ReturnType<typeof createServiceRoleClient>;
		try {
			admin = createServiceRoleClient();
		} catch (e) {
			return fail(500, { error: e instanceof Error ? e.message : 'Missing service role key.' });
		}

		const now = new Date().toISOString();
		const { error } = await (admin.from('project_monitoring_public') as any)
			.update({ is_enabled: false, updated_at: now })
			.eq('project_id', params.id);
		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, 'Public monitoring status page unpublished', getActorName(locals.session!));
		return { success: true, unpublished: true };
	},

	rotatePublicToken: async ({ request, locals, params }) => {
		const gate = requireSession(locals);
		if (gate) return gate;
		if (!(await isProjectStaff(locals.supabase, locals.session!.user.id))) {
			return fail(403, { error: 'Forbidden' });
		}

		let admin: ReturnType<typeof createServiceRoleClient>;
		try {
			admin = createServiceRoleClient();
		} catch (e) {
			return fail(500, { error: e instanceof Error ? e.message : 'Missing service role key.' });
		}

		const { data: existing } = await (admin.from('project_monitoring_public') as any)
			.select('id')
			.eq('project_id', params.id)
			.maybeSingle();
		if (!existing) {
			return fail(400, { error: 'Publish the public status page first.' });
		}

		const origin = new URL(request.url).origin;
		const token = newPublicMonitoringToken();
		const now = new Date().toISOString();

		const { error } = await (admin.from('project_monitoring_public') as any)
			.update({ token, is_enabled: true, updated_at: now })
			.eq('project_id', params.id);
		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, 'Public monitoring status URL rotated', getActorName(locals.session!));
		return { success: true, publicUrl: `${origin}/status/${token}` };
	},

	createTarget: async ({ request, locals, params }) => {
		const gate = requireSession(locals);
		if (gate) return gate;
		if (!(await isProjectStaff(locals.supabase, locals.session!.user.id))) {
			return fail(403, { error: 'Forbidden' });
		}
		const form = await request.formData();
		const name = (form.get('name') as string)?.trim();
		const url = (form.get('url') as string)?.trim();
		if (!name || !url) return fail(400, { error: 'Name and URL are required' });

		const { data: maxRow } = await locals.supabase
			.from('monitoring_targets')
			.select('sort_order')
			.eq('project_id', params.id)
			.order('sort_order', { ascending: false })
			.limit(1)
			.maybeSingle();
		const nextOrder = ((maxRow as any)?.sort_order ?? -1) + 1;

		const { error } = await (locals.supabase.from('monitoring_targets') as any).insert({
			project_id: params.id,
			name,
			url,
			sort_order: nextOrder
		});
		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, `Monitoring target added: ${name}`, getActorName(locals.session!));
		return { success: true };
	},

	updateTarget: async ({ request, locals, params }) => {
		const gate = requireSession(locals);
		if (gate) return gate;
		if (!(await isProjectStaff(locals.supabase, locals.session!.user.id))) {
			return fail(403, { error: 'Forbidden' });
		}
		const form = await request.formData();
		const id = form.get('id') as string;
		const name = (form.get('name') as string)?.trim();
		const url = (form.get('url') as string)?.trim();
		const enabled = form.get('enabled') === 'true';
		if (!id) return fail(400, { error: 'Missing id' });
		if (!name || !url) return fail(400, { error: 'Name and URL are required' });

		const { error } = await (locals.supabase.from('monitoring_targets') as any)
			.update({ name, url, enabled })
			.eq('id', id)
			.eq('project_id', params.id);
		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, `Monitoring target updated: ${name}`, getActorName(locals.session!));
		return { success: true };
	},

	deleteTarget: async ({ request, locals, params }) => {
		const gate = requireSession(locals);
		if (gate) return gate;
		if (!(await isProjectStaff(locals.supabase, locals.session!.user.id))) {
			return fail(403, { error: 'Forbidden' });
		}
		const form = await request.formData();
		const id = form.get('id') as string;
		if (!id) return fail(400, { error: 'Missing id' });
		const { error } = await locals.supabase.from('monitoring_targets').delete().eq('id', id).eq('project_id', params.id);
		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, 'Monitoring target removed', getActorName(locals.session!));
		return { success: true };
	},

	importFromEnvironments: async ({ locals, params }) => {
		const gate = requireSession(locals);
		if (gate) return gate;
		if (!(await isProjectStaff(locals.supabase, locals.session!.user.id))) {
			return fail(403, { error: 'Forbidden' });
		}
		const { data: envs } = await locals.supabase.from('project_environments').select('*').eq('project_id', params.id);
		let n = 0;
		let order = 0;
		const { data: maxRow } = await locals.supabase
			.from('monitoring_targets')
			.select('sort_order')
			.eq('project_id', params.id)
			.order('sort_order', { ascending: false })
			.limit(1)
			.maybeSingle();
		order = ((maxRow as any)?.sort_order ?? -1) + 1;

		for (const e of envs ?? []) {
			const row = e as Tables<'project_environments'>;
			const u = (row.url ?? '').trim();
			if (!u) continue;
			const { data: dup } = await locals.supabase
				.from('monitoring_targets')
				.select('id')
				.eq('project_id', params.id)
				.eq('url', u)
				.maybeSingle();
			if (dup) continue;
			const label = `${row.kind} URL`;
			const { error } = await (locals.supabase.from('monitoring_targets') as any).insert({
				project_id: params.id,
				name: label,
				url: u,
				sort_order: order++
			});
			if (!error) n++;
		}
		await logActivity(locals.supabase, params.id, `Imported ${n} monitoring targets from environments`, getActorName(locals.session!));
		return { success: true, imported: n };
	},

	runChecksNow: async ({ locals, params }) => {
		const gate = requireSession(locals);
		if (gate) return gate;
		if (!(await isProjectStaff(locals.supabase, locals.session!.user.id))) {
			return fail(403, { error: 'Forbidden' });
		}
		try {
			const { checked } = await runMonitoringChecks(locals.supabase as any, { projectId: params.id });
			await logActivity(
				locals.supabase,
				params.id,
				`Monitoring checks run (${checked} targets)`,
				getActorName(locals.session!)
			);
			return { success: true, checked };
		} catch (e) {
			return fail(500, { error: e instanceof Error ? e.message : 'Checks failed' });
		}
	}
};

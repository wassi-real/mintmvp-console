import type { PageServerLoad, Actions } from './$types';
import type { Tables } from '$lib/supabase/types';
import { fail } from '@sveltejs/kit';
import { createServiceRoleClient } from '$lib/supabase/server';
import { isProjectStaff } from '$lib/server/roles';
import { logActivity, getActorName } from '$lib/server/activity';
import { pollRailwayLogsForProject } from '$lib/server/railway/poll-railway-logs';

export const load: PageServerLoad = async ({ locals, params }) => {
	const { data: projectGate } = await locals.supabase
		.from('projects')
		.select('id')
		.eq('id', params.id)
		.maybeSingle();
	if (!projectGate) {
		return {
			railway: null,
			deployLogEntries: [],
			deployLogEvents: [],
			canManageRailway: false
		};
	}

	let railwayFull: Tables<'project_integrations_railway'> | null = null;
	try {
		const admin = createServiceRoleClient();
		const { data: r } = await admin
			.from('project_integrations_railway')
			.select('*')
			.eq('project_id', params.id)
			.maybeSingle();
		railwayFull = (r ?? null) as Tables<'project_integrations_railway'> | null;
	} catch {
		const { data: r } = await locals.supabase
			.from('project_integrations_railway')
			.select('*')
			.eq('project_id', params.id)
			.maybeSingle();
		railwayFull = (r ?? null) as Tables<'project_integrations_railway'> | null;
	}

	const [{ data: entries }, { data: events }] = await Promise.all([
		locals.supabase
			.from('deploy_log_entries')
			.select('*')
			.eq('project_id', params.id)
			.order('logged_at', { ascending: false })
			.limit(450),
		locals.supabase
			.from('deploy_log_events')
			.select('*')
			.eq('project_id', params.id)
			.order('occurred_at', { ascending: false })
			.limit(150)
	]);

	const row = railwayFull;
	const canManage =
		locals.session?.user?.id != null && (await isProjectStaff(locals.supabase, locals.session.user.id));

	return {
		railway: row
			? {
					enabled: row.enabled,
					railway_project_id: row.railway_project_id,
					railway_environment_id: row.railway_environment_id,
					railway_service_id: row.railway_service_id,
					last_poll_at: row.last_poll_at,
					last_poll_error: row.last_poll_error,
					hasToken: Boolean(row.api_token?.trim())
				}
			: null,
		deployLogEntries: (entries ?? []) as Tables<'deploy_log_entries'>[],
		deployLogEvents: (events ?? []) as Tables<'deploy_log_events'>[],
		canManageRailway: canManage
	};
};

function requireSessionUser(locals: { session: { user: { id: string } } | null }) {
	if (!locals.session?.user?.id) return fail(401, { error: 'Unauthorized' });
	return null;
}

export const actions: Actions = {
	saveRailway: async ({ request, locals, params }) => {
		const gate = requireSessionUser(locals);
		if (gate) return gate;
		if (!(await isProjectStaff(locals.supabase, locals.session!.user.id))) {
			return fail(403, { error: 'Forbidden' });
		}

		let admin: ReturnType<typeof createServiceRoleClient>;
		try {
			admin = createServiceRoleClient();
		} catch (e) {
			return fail(500, {
				error: e instanceof Error ? e.message : 'SUPABASE_SERVICE_ROLE_KEY is required to save Railway credentials.'
			});
		}

		const form = await request.formData();
		const apiTokenIn = (form.get('api_token') as string)?.trim() ?? '';
		const railway_project_id = (form.get('railway_project_id') as string)?.trim() ?? '';
		const railway_environment_id = (form.get('railway_environment_id') as string)?.trim() ?? '';
		const railway_service_id = (form.get('railway_service_id') as string)?.trim() ?? '';
		const enabled = form.get('enabled') === 'on';

		const { data: cur } = await admin
			.from('project_integrations_railway')
			.select('api_token')
			.eq('project_id', params.id)
			.maybeSingle();
		const prev = cur as { api_token: string } | null;
		const api_token = apiTokenIn.length > 0 ? apiTokenIn : (prev?.api_token ?? '');

		const now = new Date().toISOString();
		const payload = {
			project_id: params.id,
			api_token,
			railway_project_id,
			railway_environment_id,
			railway_service_id,
			enabled,
			updated_at: now
		};

		const { error: userUpsertErr } = await (locals.supabase.from('project_integrations_railway') as any).upsert(
			payload,
			{ onConflict: 'project_id' }
		);
		if (userUpsertErr) {
			const { error: adminErr } = await (admin.from('project_integrations_railway') as any).upsert(payload, {
				onConflict: 'project_id'
			});
			if (adminErr) return fail(500, { error: `${userUpsertErr.message} (${adminErr.message})` });
		}

		await logActivity(
			locals.supabase,
			params.id,
			'Railway log integration updated',
			getActorName(locals.session!)
		);
		return { success: true, savedRailway: true };
	},

	pollNow: async ({ locals, params }) => {
		const gate = requireSessionUser(locals);
		if (gate) return gate;
		if (!(await isProjectStaff(locals.supabase, locals.session!.user.id))) {
			return fail(403, { error: 'Forbidden' });
		}

		let admin: ReturnType<typeof createServiceRoleClient>;
		try {
			admin = createServiceRoleClient();
		} catch (e) {
			return fail(500, {
				error: e instanceof Error ? e.message : 'SUPABASE_SERVICE_ROLE_KEY is required to poll Railway.'
			});
		}

		const { data: row, error: fetchErr } = await admin
			.from('project_integrations_railway')
			.select('*')
			.eq('project_id', params.id)
			.maybeSingle();
		if (fetchErr) return fail(500, { error: fetchErr.message });
		if (!row) {
			return fail(400, { error: 'Save Railway settings (token and IDs) before pulling logs.' });
		}

		try {
			const { linesInserted, eventsInserted } = await pollRailwayLogsForProject(
				admin as any,
				params.id,
				row as Tables<'project_integrations_railway'>
			);
			const ts = new Date().toISOString();
			await (admin.from('project_integrations_railway') as any)
				.update({ last_poll_at: ts, last_poll_error: null, updated_at: ts })
				.eq('project_id', params.id);
			await logActivity(
				locals.supabase,
				params.id,
				`Railway logs polled: ${linesInserted} new lines, ${eventsInserted} parsed events`,
				getActorName(locals.session!)
			);
			return { success: true, polled: true, linesInserted, eventsInserted };
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			const ts = new Date().toISOString();
			await (admin.from('project_integrations_railway') as any)
				.update({ last_poll_at: ts, last_poll_error: msg.slice(0, 2000), updated_at: ts })
				.eq('project_id', params.id);
			return fail(502, { error: msg });
		}
	}
};

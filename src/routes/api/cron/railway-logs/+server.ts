import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createServiceRoleClient } from '$lib/supabase/server';
import { assertMonitoringCronAuth, getMonitoringCronSecret } from '$lib/server/monitoring-env';
import { pollAllRailwayIntegrations } from '$lib/server/railway/poll-railway-logs';

export const POST: RequestHandler = async ({ request }) => {
	if (!getMonitoringCronSecret()) {
		throw error(503, 'MONITORING_CRON_SECRET is not configured');
	}
	if (!assertMonitoringCronAuth(request)) {
		throw error(401, 'Unauthorized');
	}

	const admin = createServiceRoleClient();
	const summary = await pollAllRailwayIntegrations(admin as any);
	return json({ ok: true, ...summary });
};

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createServiceRoleClient } from '$lib/supabase/server';
import { assertMonitoringCronAuth, getMonitoringCronSecret } from '$lib/server/monitoring-env';
import { runMonitoringChecks } from '$lib/server/monitoring-checks';

export const POST: RequestHandler = async ({ request }) => {
	if (!getMonitoringCronSecret()) {
		throw error(503, 'MONITORING_CRON_SECRET is not configured');
	}
	if (!assertMonitoringCronAuth(request)) {
		throw error(401, 'Unauthorized');
	}

	const admin = createServiceRoleClient();
	const { checked } = await runMonitoringChecks(admin as any);
	return json({ ok: true, checked });
};

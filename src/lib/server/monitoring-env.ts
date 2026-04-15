/**
 * Bearer secret for POST /api/cron/monitoring-check (optional).
 * Example: curl -X POST -H "Authorization: Bearer $MONITORING_CRON_SECRET" https://host/api/cron/monitoring-check
 */
export function getMonitoringCronSecret(): string | null {
	const raw = typeof process !== 'undefined' ? process.env.MONITORING_CRON_SECRET : undefined;
	const s = typeof raw === 'string' ? raw.trim() : '';
	return s.length > 0 ? s : null;
}

export function assertMonitoringCronAuth(request: Request): boolean {
	const secret = getMonitoringCronSecret();
	if (!secret) return false;
	const auth = request.headers.get('authorization') ?? '';
	const token = auth.replace(/^Bearer\s+/i, '').trim();
	return token === secret;
}

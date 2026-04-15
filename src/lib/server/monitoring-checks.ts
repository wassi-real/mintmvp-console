import type { SupabaseClient } from '@supabase/supabase-js';

const FETCH_TIMEOUT_MS = 10_000;

export type CheckOneResult = {
	targetId: string;
	projectId: string;
	ok: boolean;
	httpStatus: number | null;
	durationMs: number;
	errorMessage: string | null;
};

async function probeUrl(url: string): Promise<{
	ok: boolean;
	httpStatus: number | null;
	durationMs: number;
	errorMessage: string | null;
}> {
	const started = Date.now();
	try {
		const ctrl = new AbortController();
		const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
		const res = await fetch(url, {
			method: 'GET',
			signal: ctrl.signal,
			redirect: 'follow',
			headers: {
				'User-Agent': 'MintMVP-Console/1.0 (monitoring)',
				Accept: '*/*'
			}
		});
		clearTimeout(t);
		const durationMs = Date.now() - started;
		const ok = res.ok;
		return {
			ok,
			httpStatus: res.status,
			durationMs,
			errorMessage: ok ? null : `HTTP ${res.status}`
		};
	} catch (e) {
		const durationMs = Date.now() - started;
		const msg = e instanceof Error ? e.message : String(e);
		return { ok: false, httpStatus: null, durationMs, errorMessage: msg.slice(0, 500) };
	}
}

/**
 * Run HTTP checks for all enabled targets (optionally limited to one project).
 * Uses the given client for inserts (service role for cron, user supabase for "run now").
 */
export async function runMonitoringChecks(
	supabase: SupabaseClient,
	opts?: { projectId?: string }
): Promise<{ checked: number; results: CheckOneResult[] }> {
	let builder = supabase.from('monitoring_targets').select('id, project_id, url').eq('enabled', true);
	if (opts?.projectId) {
		builder = builder.eq('project_id', opts.projectId);
	}
	const { data: targets, error } = await builder;
	if (error) throw new Error(error.message);
	const rows = (targets ?? []) as { id: string; project_id: string; url: string }[];
	const results: CheckOneResult[] = [];

	for (const t of rows) {
		const r = await probeUrl(t.url);
		const { error: insErr } = await (supabase.from('monitoring_check_runs') as any).insert({
			target_id: t.id,
			ok: r.ok,
			http_status: r.httpStatus,
			duration_ms: r.durationMs,
			error_message: r.errorMessage
		});
		if (insErr) throw new Error(insErr.message);
		results.push({
			targetId: t.id,
			projectId: t.project_id,
			ok: r.ok,
			httpStatus: r.httpStatus,
			durationMs: r.durationMs,
			errorMessage: r.errorMessage
		});
	}

	const projectIds = [...new Set(results.map((r) => r.projectId))];
	for (const pid of projectIds) {
		await rollupProjectHealth(supabase, pid);
	}

	return { checked: results.length, results };
}

/**
 * Set project_health from latest run per target (best-effort transparency rollup).
 */
export async function rollupProjectHealth(supabase: SupabaseClient, projectId: string): Promise<void> {
	const { data: targets } = await supabase.from('monitoring_targets').select('id').eq('project_id', projectId);
	const tids = (targets ?? []).map((x: any) => x.id as string);
	if (!tids.length) return;

	let fail = 0;
	let anyMissing = false;
	for (const tid of tids) {
		const { data: last } = await supabase
			.from('monitoring_check_runs')
			.select('ok, http_status')
			.eq('target_id', tid)
			.order('checked_at', { ascending: false })
			.limit(1)
			.maybeSingle();
		const row = last as { ok: boolean; http_status: number | null } | null;
		if (!row) {
			anyMissing = true;
			continue;
		}
		if (!row.ok) fail++;
	}

	let uptime: 'up' | 'down' | 'degraded' | 'unknown' = 'unknown';
	if (fail > 0) uptime = 'down';
	else if (anyMissing) uptime = 'degraded';
	else if (tids.length > 0) uptime = 'up';

	const { data: health } = await supabase.from('project_health').select('id').eq('project_id', projectId).maybeSingle();
	if (!health) {
		await (supabase.from('project_health') as any).insert({
			project_id: projectId,
			uptime_status: uptime,
			error_count: fail,
			warning_count: anyMissing ? 1 : 0,
			last_check_at: new Date().toISOString()
		});
		return;
	}

	await (supabase.from('project_health') as any)
		.update({
			uptime_status: uptime,
			error_count: fail,
			warning_count: anyMissing ? 1 : 0,
			last_check_at: new Date().toISOString()
		})
		.eq('project_id', projectId);
}

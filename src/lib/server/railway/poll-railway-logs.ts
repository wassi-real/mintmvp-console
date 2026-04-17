import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables } from '$lib/supabase/types';
import {
	fetchBuildLogs,
	fetchDeploymentLogs,
	listRailwayDeployments
} from './graphql';
import {
	extractSignalsFromLogLine,
	inferSeverityFromAttrs,
	logAttributesToRecord
} from './parse-log-line';

function bumpIso(iso: string, deltaMs: number): string {
	const t = new Date(iso).getTime();
	if (Number.isNaN(t)) return new Date(Date.now() + deltaMs).toISOString();
	return new Date(Math.max(0, t + deltaMs)).toISOString();
}

async function maxLoggedAt(
	supabase: SupabaseClient,
	projectId: string,
	railwayDeploymentId: string,
	logKind: string
): Promise<string | null> {
	const { data } = await supabase
		.from('deploy_log_entries')
		.select('logged_at')
		.eq('project_id', projectId)
		.eq('railway_deployment_id', railwayDeploymentId)
		.eq('log_kind', logKind)
		.order('logged_at', { ascending: false })
		.limit(1)
		.maybeSingle();
	const row = data as { logged_at: string } | null;
	return row?.logged_at ?? null;
}

function dedupeKey(
	projectId: string,
	railwayDeploymentId: string,
	logKind: string,
	timestamp: string,
	message: string
): string {
	const h = createHash('sha256')
		.update(`${railwayDeploymentId}|${logKind}|${timestamp}|${message}`)
		.digest('hex');
	return `${projectId.slice(0, 8)}_${h}`;
}

async function ingestOneLine(
	supabase: SupabaseClient,
	projectId: string,
	railwayDeploymentId: string,
	logKind: 'deploy' | 'build',
	line: { timestamp: string; message: string; attributes?: { key: string; value: string }[] | null }
): Promise<{ lines: number; events: number }> {
	const attrs = logAttributesToRecord(line.attributes);
	const message = (line.message ?? '').trim();
	if (!message) return { lines: 0, events: 0 };

	const loggedAt = line.timestamp;
	const severity = inferSeverityFromAttrs(attrs, message);
	const key = dedupeKey(projectId, railwayDeploymentId, logKind, loggedAt, message);

	const { data: inserted, error } = await (supabase.from('deploy_log_entries') as any)
		.insert({
			project_id: projectId,
			railway_deployment_id: railwayDeploymentId,
			log_kind: logKind,
			logged_at: loggedAt,
			message,
			severity,
			attributes: attrs,
			dedupe_key: key
		})
		.select('id')
		.maybeSingle();

	if (error) {
		if ((error as { code?: string }).code === '23505') return { lines: 0, events: 0 };
		throw new Error((error as { message?: string }).message ?? String(error));
	}
	if (!inserted?.id) return { lines: 0, events: 0 };

	const entryId = inserted.id as string;
	const signals = extractSignalsFromLogLine(message, attrs);
	if (!signals.length) return { lines: 1, events: 0 };

	let events = 0;
	for (const s of signals) {
		const { error: evErr } = await (supabase.from('deploy_log_events') as any).insert({
			project_id: projectId,
			railway_deployment_id: railwayDeploymentId,
			kind: s.kind,
			severity: s.severity,
			title: s.title,
			detail: s.detail,
			occurred_at: loggedAt,
			source_entry_id: entryId
		});
		if (evErr) throw new Error(evErr.message);
		events++;
	}
	return { lines: 1, events };
}

export type RailwayPollResult = {
	projectId: string;
	linesInserted: number;
	eventsInserted: number;
	error?: string;
};

/**
 * Pull recent Railway deployment + (failed/building) build logs, dedupe store, and emit parsed events.
 */
export async function pollRailwayLogsForProject(
	supabase: SupabaseClient,
	projectId: string,
	integration: Tables<'project_integrations_railway'>
): Promise<{ linesInserted: number; eventsInserted: number }> {
	const token = integration.api_token?.trim();
	if (!token) throw new Error('Railway API token is empty');

	const pid = integration.railway_project_id?.trim();
	const eid = integration.railway_environment_id?.trim();
	const sid = integration.railway_service_id?.trim();
	if (!pid || !eid || !sid) {
		throw new Error('Set Railway project ID, environment ID, and service ID (from the Railway dashboard).');
	}

	const deployments = await listRailwayDeployments(
		token,
		{ projectId: pid, environmentId: eid, serviceId: sid },
		30
	);
	deployments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
	const top = deployments.slice(0, 20);

	let linesInserted = 0;
	let eventsInserted = 0;

	for (const dep of top) {
		const startDeploy = await maxLoggedAt(supabase, projectId, dep.id, 'deploy');
		const deployLines = await fetchDeploymentLogs(token, dep.id, {
			limit: 400,
			startDate: startDeploy ? bumpIso(startDeploy, -3000) : null
		});
		for (const line of deployLines) {
			const r = await ingestOneLine(supabase, projectId, dep.id, 'deploy', line);
			linesInserted += r.lines;
			eventsInserted += r.events;
		}

		const st = (dep.status ?? '').toUpperCase();
		const pullBuild = st === 'FAILED' || st === 'BUILDING' || st === 'CRASHED';
		if (pullBuild) {
			const startBuild = await maxLoggedAt(supabase, projectId, dep.id, 'build');
			const buildLines = await fetchBuildLogs(token, dep.id, {
				limit: 400,
				startDate: startBuild ? bumpIso(startBuild, -3000) : null
			});
			for (const line of buildLines) {
				const r = await ingestOneLine(supabase, projectId, dep.id, 'build', line);
				linesInserted += r.lines;
				eventsInserted += r.events;
			}
		}
	}

	return { linesInserted, eventsInserted };
}

export async function pollAllRailwayIntegrations(
	supabase: SupabaseClient
): Promise<{ integrations: number; results: RailwayPollResult[] }> {
	const { data: rows, error } = await supabase
		.from('project_integrations_railway')
		.select('*')
		.eq('enabled', true);
	if (error) throw new Error(error.message);

	const list = (rows ?? []) as Tables<'project_integrations_railway'>[];
	const results: RailwayPollResult[] = [];
	const now = new Date().toISOString();

	for (const row of list) {
		const token = row.api_token?.trim();
		const pid = row.railway_project_id?.trim();
		const eid = row.railway_environment_id?.trim();
		const sid = row.railway_service_id?.trim();
		if (!token || !pid || !eid || !sid) {
			results.push({
				projectId: row.project_id,
				linesInserted: 0,
				eventsInserted: 0,
				error: 'Skipped: incomplete Railway configuration'
			});
			continue;
		}
		try {
			const { linesInserted, eventsInserted } = await pollRailwayLogsForProject(
				supabase,
				row.project_id,
				row
			);
			await (supabase.from('project_integrations_railway') as any)
				.update({ last_poll_at: now, last_poll_error: null, updated_at: now })
				.eq('project_id', row.project_id);
			results.push({ projectId: row.project_id, linesInserted, eventsInserted });
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			await (supabase.from('project_integrations_railway') as any)
				.update({ last_poll_at: now, last_poll_error: msg.slice(0, 2000), updated_at: now })
				.eq('project_id', row.project_id);
			results.push({ projectId: row.project_id, linesInserted: 0, eventsInserted: 0, error: msg });
		}
	}

	return { integrations: list.length, results };
}

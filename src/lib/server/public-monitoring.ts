import { randomBytes } from 'node:crypto';
import { error } from '@sveltejs/kit';
import { createServiceRoleClient } from '$lib/supabase/server';
import type { Tables } from '$lib/supabase/types';

const TOKEN_RE = /^[a-f0-9]{64}$/;

export function newPublicMonitoringToken(): string {
	return randomBytes(32).toString('hex');
}

export type PublicMonitoringPayload = {
	projectName: string;
	health: Tables<'project_health'> | null;
	openIncidents: number;
	totalIncidents: number;
	updatedAt: string | null;
};

/**
 * Load monitoring snapshot for a public status URL. Uses service role after token validation only.
 */
export async function loadPublicMonitoringByToken(rawToken: string): Promise<PublicMonitoringPayload> {
	const token = rawToken.trim().toLowerCase();
	if (!TOKEN_RE.test(token)) {
		throw error(404, 'Not found');
	}

	const admin = createServiceRoleClient();

	const { data: link, error: linkErr } = await (admin.from('project_monitoring_public') as any)
		.select('project_id, is_enabled')
		.eq('token', token)
		.maybeSingle();

	if (linkErr || !link || !link.is_enabled) {
		throw error(404, 'Not found');
	}

	const projectId = link.project_id as string;

	const [{ data: project, error: pErr }, { data: health }, { data: incidents }] = await Promise.all([
		admin.from('projects').select('name').eq('id', projectId).maybeSingle(),
		admin.from('project_health').select('*').eq('project_id', projectId).maybeSingle(),
		admin.from('incidents').select('id, status').eq('project_id', projectId)
	]);

	if (pErr || !project) {
		throw error(404, 'Not found');
	}

	const inc = (incidents ?? []) as { id: string; status: string }[];

	return {
		projectName: (project as { name: string }).name,
		health: health as Tables<'project_health'> | null,
		openIncidents: inc.filter((i) => i.status === 'open').length,
		totalIncidents: inc.length,
		updatedAt: (health as Tables<'project_health'> | null)?.last_check_at ?? null
	};
}

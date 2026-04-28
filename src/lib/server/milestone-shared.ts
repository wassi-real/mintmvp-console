import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '$lib/supabase/types';
import type { FinanceMilestoneSummary, MilestoneWithRelations } from '$lib/milestone-shared';
import { sortMilestoneSlicesFromDb } from '$lib/milestone-shared';

export async function orgUserIdSet(
	supabase: SupabaseClient<Database>,
	projectId: string
): Promise<{ orgId: string; allowed: Set<string> } | null> {
	const { data: proj } = await supabase.from('projects').select('organization_id').eq('id', projectId).single();
	if (!proj) return null;
	const { data: users } = await supabase.from('users').select('id').eq('organization_id', proj.organization_id);
	return { orgId: proj.organization_id, allowed: new Set((users ?? []).map((u) => u.id)) };
}

/** Minimal milestone rows for Finance (payments, overview stats). */
export async function loadFinanceMilestoneSummaries(
	supabase: SupabaseClient<Database>,
	projectId: string
): Promise<FinanceMilestoneSummary[]> {
	const { data: milestones } = await supabase
		.from('milestones')
		.select('id, title, amount, status, due_date')
		.eq('project_id', projectId)
		.order('created_at', { ascending: false });
	return (milestones ?? []) as FinanceMilestoneSummary[];
}

/** Full milestone workspace for the Milestones area (list, create, edit). */
export async function loadMilestoneWorkspace(
	supabase: SupabaseClient<Database>,
	projectId: string
): Promise<{
	milestones: MilestoneWithRelations[];
	tasks: { id: string; title: string }[];
	specs: { id: string; title: string }[];
	orgUsers: { id: string; full_name: string }[];
}> {
	const { data: project, error: projErr } = await supabase
		.from('projects')
		.select('organization_id')
		.eq('id', projectId)
		.single();

	if (projErr || !project) {
		return {
			milestones: [],
			tasks: [],
			specs: [],
			orgUsers: []
		};
	}

	const orgId = project.organization_id;

	const [
		{ data: milestones },
		{ data: tasks },
		{ data: specs },
		{ data: orgUsers }
	] = await Promise.all([
		supabase
			.from('milestones')
			.select('*')
			.eq('project_id', projectId)
			.order('created_at', { ascending: false }),
		supabase.from('tasks').select('id, title').eq('project_id', projectId).order('title'),
		supabase.from('specs').select('id, title').eq('project_id', projectId).order('title'),
		supabase.from('users').select('id, full_name').eq('organization_id', orgId).order('full_name')
	]);

	const msList = (milestones ?? []) as Tables<'milestones'>[];
	const milestoneIds = msList.map((m) => m.id);

	let sliceRows: Tables<'milestone_slices'>[] = [];
	let linkRows: { milestone_id: string; task_id: string }[] = [];

	if (milestoneIds.length > 0) {
		const [{ data: s }, { data: l }] = await Promise.all([
			supabase
				.from('milestone_slices')
				.select('*')
				.in('milestone_id', milestoneIds)
				.order('sort_order'),
			supabase.from('milestone_task_links').select('milestone_id, task_id').in('milestone_id', milestoneIds)
		]);
		sliceRows = (s ?? []) as Tables<'milestone_slices'>[];
		linkRows = (l ?? []) as { milestone_id: string; task_id: string }[];
	}

	const slicesByMs = new Map<string, Tables<'milestone_slices'>[]>();
	for (const s of sliceRows) {
		const arr = slicesByMs.get(s.milestone_id) ?? [];
		arr.push(s);
		slicesByMs.set(s.milestone_id, arr);
	}
	const linksByMs = new Map<string, string[]>();
	for (const l of linkRows) {
		const arr = linksByMs.get(l.milestone_id) ?? [];
		arr.push(l.task_id);
		linksByMs.set(l.milestone_id, arr);
	}

	const milestonesWithRelations: MilestoneWithRelations[] = msList.map((m) => ({
		...m,
		slices: sortMilestoneSlicesFromDb(slicesByMs.get(m.id) ?? []),
		linked_task_ids: linksByMs.get(m.id) ?? []
	}));

	return {
		milestones: milestonesWithRelations,
		tasks: (tasks ?? []) as { id: string; title: string }[],
		specs: (specs ?? []) as { id: string; title: string }[],
		orgUsers: (orgUsers ?? []) as { id: string; full_name: string }[]
	};
}

import type { Tables } from '$lib/supabase/types';

export type MilestoneWithRelations = Tables<'milestones'> & {
	slices: Tables<'milestone_slices'>[];
	linked_task_ids: string[];
};

export const PRIORITIES = ['p1_critical', 'p2_high', 'p3_normal', 'p4_low'] as const;
export const PHASES = [
	'discovery',
	'planning',
	'execution',
	'internal_testing',
	'client_review',
	'approved',
	'released',
	'blocked',
	'closed'
] as const;
export const SLICE_STATUSES = ['pending', 'in_progress', 'done', 'blocked'] as const;
export const BILL_STATUSES = ['draft', 'sent', 'paid', 'overdue'] as const;

export type ParsedSlice = {
	title: string;
	status: (typeof SLICE_STATUSES)[number];
	notes: string;
	owner_user_id: string | null;
	estimate: string;
	depends_on: string | null;
	phase: (typeof PHASES)[number];
};

export function parseSlicesJson(raw: unknown, allowedUserIds: Set<string>): ParsedSlice[] {
	if (typeof raw !== 'string' || !raw.trim()) return [];
	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		const out: ParsedSlice[] = [];
		for (const item of parsed) {
			if (!item || typeof item !== 'object') continue;
			const title = String((item as { title?: unknown }).title ?? '').trim();
			if (!title) continue;
			let status = String((item as { status?: unknown }).status ?? 'pending');
			if (!SLICE_STATUSES.includes(status as (typeof SLICE_STATUSES)[number])) status = 'pending';
			const notes = String((item as { notes?: unknown }).notes ?? '').trim();
			const estimate = String((item as { estimate?: unknown }).estimate ?? '').trim();
			const ownerRaw = String((item as { owner_user_id?: unknown }).owner_user_id ?? '').trim();
			const owner_user_id =
				ownerRaw && allowedUserIds.has(ownerRaw) ? ownerRaw : null;
			const depRaw = String((item as { depends_on?: unknown }).depends_on ?? '').trim();
			const depends_on = depRaw || null;
			let slicePhase = String((item as { phase?: unknown }).phase ?? 'discovery').trim();
			if (!PHASES.includes(slicePhase as (typeof PHASES)[number])) slicePhase = 'discovery';
			out.push({
				title,
				status: status as (typeof SLICE_STATUSES)[number],
				notes,
				owner_user_id,
				estimate,
				depends_on,
				phase: slicePhase as (typeof PHASES)[number]
			});
		}
		return out;
	} catch {
		return [];
	}
}

export type FinanceMilestoneSummary = Pick<
	Tables<'milestones'>,
	'id' | 'title' | 'amount' | 'status' | 'due_date'
>;

export function normalizeSlicePhaseValue(p: string | null | undefined): (typeof PHASES)[number] {
	if (p && PHASES.includes(p as (typeof PHASES)[number])) return p as (typeof PHASES)[number];
	return 'discovery';
}

/** Sort slices by workflow phase order, then DB sort_order. */
export function sortMilestoneSlicesFromDb(slices: Tables<'milestone_slices'>[]): Tables<'milestone_slices'>[] {
	return [...slices].sort((a, b) => {
		const ia = PHASES.indexOf(normalizeSlicePhaseValue(a.phase));
		const ib = PHASES.indexOf(normalizeSlicePhaseValue(b.phase));
		if (ia !== ib) return ia - ib;
		return (a.sort_order ?? 0) - (b.sort_order ?? 0);
	});
}

/** Group sorted DB slices under phase headings (fixed phase order). */
export function groupDbSlicesByPhase(slices: Tables<'milestone_slices'>[]): {
	phase: (typeof PHASES)[number];
	slices: Tables<'milestone_slices'>[];
}[] {
	const sorted = sortMilestoneSlicesFromDb(slices);
	const out: { phase: (typeof PHASES)[number]; slices: Tables<'milestone_slices'>[] }[] = [];
	for (const ph of PHASES) {
		const group = sorted.filter((s) => normalizeSlicePhaseValue(s.phase) === ph);
		if (group.length > 0) out.push({ phase: ph, slices: group });
	}
	return out;
}

/** Group draft/UI slices by phase while preserving original order within each phase. */
export function groupDraftSlicesByPhase<T extends { phase?: string | null }>(
	slices: T[],
	includeSlice?: (s: T) => boolean
): { phase: (typeof PHASES)[number]; slices: T[] }[] {
	const pred = includeSlice ?? (() => true);
	const filtered = slices.filter(pred);
	const indexed = filtered.map((row, i) => ({ row, i }));
	indexed.sort((a, b) => {
		const ia = PHASES.indexOf(normalizeSlicePhaseValue(a.row.phase));
		const ib = PHASES.indexOf(normalizeSlicePhaseValue(b.row.phase));
		if (ia !== ib) return ia - ib;
		return a.i - b.i;
	});
	const sortedRows = indexed.map((x) => x.row);
	const out: { phase: (typeof PHASES)[number]; slices: T[] }[] = [];
	for (const ph of PHASES) {
		const group = sortedRows.filter((s) => normalizeSlicePhaseValue(s.phase) === ph);
		if (group.length > 0) out.push({ phase: ph, slices: group });
	}
	return out;
}

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
function normalizeSliceScheduleField(v: unknown): string | null {
	if (v == null || v === '') return null;
	const s = String(v).trim();
	return s.length ? s : null;
}

/**
 * Parses a pasted schedule string for sorting/rollups. ISO YYYY-MM-DD uses local noon;
 * other values use `Date.parse` when it yields a finite time.
 */
export function parseScheduleToTime(raw: string | null | undefined): number | null {
	if (raw == null) return null;
	const s = raw.trim();
	if (!s) return null;
	if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
		return new Date(s + 'T12:00:00').getTime();
	}
	const ms = Date.parse(s);
	return Number.isNaN(ms) ? null : ms;
}

/** Sort key for slice schedule text; unparsable values sort last. */
export function scheduleSortKey(raw: string | null | undefined): number {
	return parseScheduleToTime(raw) ?? Number.MAX_SAFE_INTEGER;
}

/** List/preview display: pretty ISO dates, otherwise raw pasted text. */
export function displaySliceSchedule(raw: string | null | undefined): string {
	if (!raw?.trim()) return '--';
	const t = raw.trim();
	if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
		return new Date(t + 'T12:00:00').toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
	return t;
}

export type ParsedSlice = {
	title: string;
	status: (typeof SLICE_STATUSES)[number];
	notes: string;
	owner_user_id: string | null;
	estimate: string;
	depends_on: string | null;
	phase: (typeof PHASES)[number];
	start_date: string | null;
	deadline: string | null;
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
			const start_date = normalizeSliceScheduleField((item as { start_date?: unknown }).start_date);
			const deadline = normalizeSliceScheduleField((item as { deadline?: unknown }).deadline);
			out.push({
				title,
				status: status as (typeof SLICE_STATUSES)[number],
				notes,
				owner_user_id,
				estimate,
				depends_on,
				phase: slicePhase as (typeof PHASES)[number],
				start_date,
				deadline
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

/** One-line explanation for each slice/milestone lifecycle phase (UI + API meta). */
export const PHASE_DESCRIPTIONS: Record<(typeof PHASES)[number], string> = {
	discovery: 'Clarify goals, constraints, and success criteria before committing to scope.',
	planning: 'Shape backlog, sequencing, estimates, and owners for the next delivery slice.',
	execution: 'Implement and integrate agreed scope with reviews and steady CI.',
	internal_testing: 'Team-led validation—regressions, edge cases, and release readiness.',
	client_review: 'Stakeholder demos, acceptance checks, and feedback on the increment.',
	approved: 'Formal sign-off recorded; proceed toward release or handoff.',
	released: 'Delivered to production or users; verify outcomes and close the loop.',
	blocked: 'Paused waiting on an external dependency before work can resume.',
	closed: 'Archived—outcomes reconciled and references cleaned up.'
};

export function phaseDescription(phase: string | null | undefined): string {
	return PHASE_DESCRIPTIONS[normalizeSlicePhaseValue(phase)];
}

/** Sort slices by phase, then planned start, deadline, then creation order. */
export function sortMilestoneSlicesFromDb(slices: Tables<'milestone_slices'>[]): Tables<'milestone_slices'>[] {
	return [...slices].sort((a, b) => {
		const ia = PHASES.indexOf(normalizeSlicePhaseValue(a.phase));
		const ib = PHASES.indexOf(normalizeSlicePhaseValue(b.phase));
		if (ia !== ib) return ia - ib;
		const sta = scheduleSortKey(a.start_date);
		const stb = scheduleSortKey(b.start_date);
		if (sta !== stb) return sta - stb;
		const da = scheduleSortKey(a.deadline);
		const db = scheduleSortKey(b.deadline);
		if (da !== db) return da - db;
		return (a.sort_order ?? 0) - (b.sort_order ?? 0);
	});
}

export type MilestoneSliceScheduleRollup = {
	/** Minimum slice start_date among slices that have one */
	earliestStart: string | null;
	/** Maximum slice deadline among slices that have one */
	latestDeadline: string | null;
	/**
	 * Best “next” deadline: earliest date on/after today if any,
	 * otherwise earliest deadline overall (may be in the past).
	 */
	soonestDeadline: string | null;
};

/** Aggregate slice dates onto the milestone for list/overview context. */
export function rollupMilestoneSliceSchedule(
	slices: Pick<Tables<'milestone_slices'>, 'start_date' | 'deadline'>[]
): MilestoneSliceScheduleRollup {
	let earliestStart: string | null = null;
	let latestDeadline: string | null = null;
	let soonestOverall: string | null = null;
	let bestStart = Infinity;
	let bestLatestDl = -Infinity;
	let bestSoonest = Infinity;

	const today = new Date();
	const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
	const todayKey = parseScheduleToTime(todayStr);
	let bestFuture = Infinity;
	let soonestFuture: string | null = null;

	for (const s of slices) {
		const sd = s.start_date;
		const dd = s.deadline;
		const sdT = parseScheduleToTime(sd);
		if (sdT != null) {
			if (sdT < bestStart) {
				bestStart = sdT;
				earliestStart = sd;
			}
		}
		const ddT = parseScheduleToTime(dd);
		if (ddT != null) {
			if (ddT > bestLatestDl) {
				bestLatestDl = ddT;
				latestDeadline = dd;
			}
			if (ddT < bestSoonest) {
				bestSoonest = ddT;
				soonestOverall = dd;
			}
			if (todayKey != null && ddT >= todayKey && ddT < bestFuture) {
				bestFuture = ddT;
				soonestFuture = dd;
			}
		}
	}

	const soonestDeadline = soonestFuture ?? soonestOverall;

	return { earliestStart, latestDeadline, soonestDeadline };
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
		const ra = a.row as { start_date?: string | null; deadline?: string | null };
		const rb = b.row as { start_date?: string | null; deadline?: string | null };
		const sta = scheduleSortKey(ra.start_date);
		const stb = scheduleSortKey(rb.start_date);
		if (sta !== stb) return sta - stb;
		const da = scheduleSortKey(ra.deadline);
		const db = scheduleSortKey(rb.deadline);
		if (da !== db) return da - db;
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

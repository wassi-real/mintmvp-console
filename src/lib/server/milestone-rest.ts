import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Tables } from '$lib/supabase/types';
import { logActivity } from '$lib/server/activity';
import { orgUserIdSet } from '$lib/server/milestone-shared';
import {
	parseSlicesJson,
	type ParsedSlice,
	PRIORITIES,
	PHASES,
	BILL_STATUSES,
	sortMilestoneSlicesFromDb
} from '$lib/milestone-shared';

const ACTOR_API = 'API';

type Db = SupabaseClient<Database>;

export async function fetchMilestoneWithRelations(
	supabase: Db,
	projectId: string,
	milestoneId: string
): Promise<{ ok: false } | { ok: true; row: Tables<'milestones'>; slices: Tables<'milestone_slices'>[]; linked_task_ids: string[] }> {
	const { data: row, error } = await supabase
		.from('milestones')
		.select('*')
		.eq('id', milestoneId)
		.eq('project_id', projectId)
		.maybeSingle();

	if (error || !row) return { ok: false };

	const [sRes, lRes] = await Promise.all([
		supabase.from('milestone_slices').select('*').eq('milestone_id', milestoneId).order('sort_order'),
		supabase.from('milestone_task_links').select('task_id').eq('milestone_id', milestoneId)
	]);

	if (sRes.error || lRes.error) return { ok: false };

	const slices = sortMilestoneSlicesFromDb((sRes.data ?? []) as Tables<'milestone_slices'>[]);
	const linked_task_ids = (lRes.data ?? []).map((r: { task_id: string }) => r.task_id);

	return {
		ok: true,
		row: row as Tables<'milestones'>,
		slices,
		linked_task_ids
	};
}

function trimStr(v: unknown): string {
	if (v == null) return '';
	return String(v).trim();
}

function optionalTrim(v: unknown): string | null {
	const s = trimStr(v);
	return s.length ? s : null;
}

function parseSlicesFromBody(body: Record<string, unknown>, allowed: Set<string>): ParsedSlice[] {
	if ('slices' in body && Array.isArray(body.slices)) {
		return parseSlicesJson(JSON.stringify(body.slices), allowed);
	}
	return parseSlicesJson(body.slices_json, allowed);
}

function parseLinkedTaskIds(body: Record<string, unknown>): string[] {
	const raw = body.linked_task_ids;
	if (!Array.isArray(raw)) return [];
	const ids = raw.map((x) => String(x ?? '').trim()).filter(Boolean);
	return [...new Set(ids)];
}

async function filterLinkedTasksToProject(
	supabase: Db,
	projectId: string,
	linked_task_ids: string[]
): Promise<string[]> {
	if (linked_task_ids.length === 0) return [];
	const { data: taskRows } = await supabase.from('tasks').select('id').eq('project_id', projectId).in('id', linked_task_ids);
	const allowedTasks = new Set((taskRows ?? []).map((t: { id: string }) => t.id));
	return linked_task_ids.filter((id) => allowedTasks.has(id));
}

function normalizePriority(v: unknown): Tables<'milestones'>['priority'] {
	let priority = typeof v === 'string' ? v : 'p3_normal';
	if (!PRIORITIES.includes(priority as (typeof PRIORITIES)[number])) priority = 'p3_normal';
	return priority as Tables<'milestones'>['priority'];
}

function normalizePhase(v: unknown): Tables<'milestones'>['phase'] {
	let phase = typeof v === 'string' ? v : 'discovery';
	if (!PHASES.includes(phase as (typeof PHASES)[number])) phase = 'discovery';
	return phase as Tables<'milestones'>['phase'];
}

function normalizeStatus(v: unknown): Tables<'milestones'>['status'] {
	let status = typeof v === 'string' ? v : 'planned';
	const allowed: Tables<'milestones'>['status'][] = ['planned', 'active', 'ready_for_payment', 'paid', 'overdue'];
	if (!allowed.includes(status as Tables<'milestones'>['status'])) status = 'planned';
	return status as Tables<'milestones'>['status'];
}

function parseAttachBill(v: unknown): boolean {
	if (typeof v === 'boolean') return v;
	if (typeof v === 'string') return v === 'yes' || v === 'true';
	return false;
}

type MilestoneScalars = Omit<
	Tables<'milestones'>,
	'id' | 'project_id' | 'created_at' | 'task_id'
>;

async function resolveSpecId(
	supabase: Db,
	projectId: string,
	spec_id_raw: string | null,
	orgAllowed: Set<string>,
	owner_raw: string | null,
	approval_raw: string | null
): Promise<{ spec_id: string | null; owner_user_id: string | null; approval_owner_user_id: string | null }> {
	let spec_id: string | null = spec_id_raw;
	if (spec_id) {
		const { data: specOk } = await supabase
			.from('specs')
			.select('id')
			.eq('id', spec_id)
			.eq('project_id', projectId)
			.maybeSingle();
		if (!specOk) spec_id = null;
	}

	let owner_user_id: string | null =
		owner_raw && orgAllowed.has(owner_raw) ? owner_raw : null;

	let approval_owner_user_id: string | null =
		approval_raw && orgAllowed.has(approval_raw) ? approval_raw : null;

	return { spec_id, owner_user_id, approval_owner_user_id };
}

/** Full milestone scalars from JSON body (create or replace-update). */
async function milestoneScalarsFromBody(
	supabase: Db,
	projectId: string,
	body: Record<string, unknown>,
	orgAllowed: Set<string>
): Promise<{ ok: false; message: string } | { ok: true; scalars: MilestoneScalars }> {
	const title = trimStr(body.title);
	const description = trimStr(body.description);
	const estimate = trimStr(body.estimate);
	const due_date = optionalTrim(body.due_date);
	const entry_gate = trimStr(body.entry_gate);
	const exit_gate = trimStr(body.exit_gate);
	const test_gate_required_tests = trimStr(body.test_gate_required_tests);
	const test_gate_pass_threshold = trimStr(body.test_gate_pass_threshold);
	const test_gate_environment = trimStr(body.test_gate_environment);
	const risks_blockers = trimStr(body.risks_blockers);
	const dependencies = trimStr(body.dependencies);
	const deliverables = trimStr(body.deliverables);
	const notes = trimStr(body.notes);

	const priority = normalizePriority(body.priority);
	const phase = normalizePhase(body.phase);
	const status = normalizeStatus(body.status);

	const amount = typeof body.amount === 'number' ? body.amount : parseFloat(trimStr(body.amount));
	const paid_date = optionalTrim(body.paid_date);

	const spec_id_raw = optionalTrim(body.spec_id);
	const owner_user_id_raw = optionalTrim(body.owner_user_id);
	const approval_owner_raw = trimStr(body.approval_owner_user_id);

	if (!title) return { ok: false, message: 'Title is required' };
	if (!description) return { ok: false, message: 'Description is required' };
	if (!estimate) return { ok: false, message: 'Estimate is required' };
	if (!due_date) return { ok: false, message: 'Due date is required' };
	if (!entry_gate) return { ok: false, message: 'Entry gate is required' };
	if (!exit_gate) return { ok: false, message: 'Exit / completion gate is required' };
	if (!test_gate_required_tests)
		return { ok: false, message: 'Test gate: required tests is required' };
	if (!test_gate_pass_threshold)
		return { ok: false, message: 'Test gate: pass threshold is required' };
	if (!test_gate_environment)
		return { ok: false, message: 'Test gate: environment is required' };
	if (!approval_owner_raw) return { ok: false, message: 'Approval owner is required' };

	const resolved = await resolveSpecId(supabase, projectId, spec_id_raw, orgAllowed, owner_user_id_raw, approval_owner_raw);
	if (!resolved.approval_owner_user_id) return { ok: false, message: 'Invalid approval owner' };

	let attach_bill_val = parseAttachBill(body.attach_bill);
	let bill_amount: number | null = null;
	let bill_status: Tables<'milestones'>['bill_status'] = null;
	const bill_amount_raw = body.bill_amount;
	const bill_status_raw = typeof body.bill_status === 'string' ? body.bill_status.trim() : '';

	if (attach_bill_val) {
		const ba =
			typeof bill_amount_raw === 'number'
				? bill_amount_raw
				: parseFloat(String(bill_amount_raw ?? '').trim());
		if (Number.isNaN(ba) || ba < 0) {
			return { ok: false, message: 'Bill amount must be a valid non-negative number' };
		}
		if (!bill_status_raw || !BILL_STATUSES.includes(bill_status_raw as (typeof BILL_STATUSES)[number])) {
			return { ok: false, message: 'Bill status is required when a bill is attached' };
		}
		bill_amount = ba;
		bill_status = bill_status_raw as Tables<'milestones'>['bill_status'];
	} else {
		attach_bill_val = false;
		bill_amount = null;
		bill_status = null;
	}

	const amt = Number.isNaN(amount) ? 0 : amount;

	const scalars: MilestoneScalars = {
		title,
		description,
		estimate,
		due_date,
		priority,
		phase,
		spec_id: resolved.spec_id,
		owner_user_id: resolved.owner_user_id,
		approval_owner_user_id: resolved.approval_owner_user_id,
		entry_gate,
		exit_gate,
		test_gate_required_tests,
		test_gate_pass_threshold,
		test_gate_environment,
		dependencies,
		risks_blockers,
		deliverables,
		notes,
		amount: amt,
		status,
		paid_date: paid_date || null,
		attach_bill: attach_bill_val,
		bill_amount,
		bill_status
	};

	return { ok: true, scalars };
}

/** Merge PATCH body onto existing row; omitted keys keep DB values. */
async function milestoneScalarsMergedFromPatch(
	supabase: Db,
	projectId: string,
	existing: Tables<'milestones'>,
	body: Record<string, unknown>,
	orgAllowed: Set<string>
): Promise<{ ok: false; message: string } | { ok: true; scalars: MilestoneScalars }> {
	const merged: Record<string, unknown> = {
		title: existing.title,
		description: existing.description,
		estimate: existing.estimate,
		due_date: existing.due_date,
		entry_gate: existing.entry_gate,
		exit_gate: existing.exit_gate,
		test_gate_required_tests: existing.test_gate_required_tests,
		test_gate_pass_threshold: existing.test_gate_pass_threshold,
		test_gate_environment: existing.test_gate_environment,
		risks_blockers: existing.risks_blockers,
		dependencies: existing.dependencies,
		deliverables: existing.deliverables,
		notes: existing.notes,
		priority: existing.priority,
		phase: existing.phase,
		spec_id: existing.spec_id,
		owner_user_id: existing.owner_user_id,
		approval_owner_user_id: existing.approval_owner_user_id,
		amount: existing.amount,
		status: existing.status,
		paid_date: existing.paid_date,
		attach_bill: existing.attach_bill,
		bill_amount: existing.bill_amount,
		bill_status: existing.bill_status
	};

	const patchKeys = [
		'title',
		'description',
		'estimate',
		'due_date',
		'entry_gate',
		'exit_gate',
		'test_gate_required_tests',
		'test_gate_pass_threshold',
		'test_gate_environment',
		'risks_blockers',
		'dependencies',
		'deliverables',
		'notes',
		'priority',
		'phase',
		'spec_id',
		'owner_user_id',
		'approval_owner_user_id',
		'amount',
		'status',
		'paid_date',
		'attach_bill',
		'bill_amount',
		'bill_status'
	] as const;

	for (const k of patchKeys) {
		if (k in body) merged[k] = body[k];
	}

	return milestoneScalarsFromBody(supabase, projectId, merged, orgAllowed);
}

export async function createMilestoneViaApi(
	supabase: Db,
	projectId: string,
	body: Record<string, unknown>
): Promise<{ ok: false; status: number; message: string } | { ok: true; milestoneId: string }> {
	const org = await orgUserIdSet(supabase, projectId);
	if (!org) return { ok: false, status: 400, message: 'Project not found' };

	const scalarsResult = await milestoneScalarsFromBody(supabase, projectId, body, org.allowed);
	if (!scalarsResult.ok) return { ok: false, status: 400, message: scalarsResult.message };

	const slices = parseSlicesFromBody(body, org.allowed);
	const linked_task_ids = await filterLinkedTasksToProject(supabase, projectId, parseLinkedTaskIds(body));
	const task_id = linked_task_ids[0] ?? null;

	const insertRow = {
		project_id: projectId,
		...scalarsResult.scalars,
		task_id
	};

	const { data: created, error } = await (supabase.from('milestones') as any).insert(insertRow).select('id').single();

	if (error) return { ok: false, status: 500, message: error.message };
	const milestoneId = created.id as string;

	if (slices.length > 0) {
		const { error: se } = await supabase.from('milestone_slices').insert(
			slices.map((s, i) => ({
				milestone_id: milestoneId,
				title: s.title,
				notes: s.notes,
				owner_user_id: s.owner_user_id,
				estimate: s.estimate,
				depends_on: s.depends_on,
				status: s.status,
				phase: s.phase,
				start_date: s.start_date,
				deadline: s.deadline,
				sort_order: i
			}))
		);
		if (se) {
			await supabase.from('milestones').delete().eq('id', milestoneId);
			return { ok: false, status: 500, message: se.message };
		}
	}

	if (linked_task_ids.length > 0) {
		const { error: le } = await supabase.from('milestone_task_links').insert(
			linked_task_ids.map((tid: string) => ({ milestone_id: milestoneId, task_id: tid }))
		);
		if (le) {
			await supabase.from('milestone_slices').delete().eq('milestone_id', milestoneId);
			await supabase.from('milestones').delete().eq('id', milestoneId);
			return { ok: false, status: 500, message: le.message };
		}
	}

	await logActivity(supabase, projectId, `Milestone created: ${scalarsResult.scalars.title}`, ACTOR_API, {
		amount: scalarsResult.scalars.amount
	});

	return { ok: true, milestoneId };
}

export async function updateMilestoneViaApi(
	supabase: Db,
	projectId: string,
	milestoneId: string,
	body: Record<string, unknown>
): Promise<{ ok: false; status: number; message: string } | { ok: true }> {
	const org = await orgUserIdSet(supabase, projectId);
	if (!org) return { ok: false, status: 400, message: 'Project not found' };

	const { data: row, error: re } = await supabase
		.from('milestones')
		.select('*')
		.eq('id', milestoneId)
		.eq('project_id', projectId)
		.maybeSingle();

	if (re) return { ok: false, status: 500, message: re.message };
	if (!row) return { ok: false, status: 404, message: 'Milestone not found' };

	const existing = row as Tables<'milestones'>;

	const scalarsResult = await milestoneScalarsMergedFromPatch(supabase, projectId, existing, body, org.allowed);
	if (!scalarsResult.ok) return { ok: false, status: 400, message: scalarsResult.message };

	let slices: ParsedSlice[] | null = null;
	if ('slices' in body || 'slices_json' in body) {
		slices = parseSlicesFromBody(body, org.allowed);
	}

	let linked_task_ids: string[] | null = null;
	if ('linked_task_ids' in body) {
		linked_task_ids = await filterLinkedTasksToProject(supabase, projectId, parseLinkedTaskIds(body));
	}

	const task_id =
		linked_task_ids !== null ? linked_task_ids[0] ?? null : existing.task_id;

	const { error } = await (supabase.from('milestones') as any)
		.update({
			...scalarsResult.scalars,
			task_id
		})
		.eq('id', milestoneId);

	if (error) return { ok: false, status: 500, message: error.message };

	if (slices !== null) {
		await supabase.from('milestone_slices').delete().eq('milestone_id', milestoneId);
		if (slices.length > 0) {
			const { error: se } = await supabase.from('milestone_slices').insert(
				slices.map((s, i) => ({
					milestone_id: milestoneId,
					title: s.title,
					notes: s.notes,
					owner_user_id: s.owner_user_id,
					estimate: s.estimate,
					depends_on: s.depends_on,
					status: s.status,
					phase: s.phase,
					start_date: s.start_date,
					deadline: s.deadline,
					sort_order: i
				}))
			);
			if (se) return { ok: false, status: 500, message: se.message };
		}
	}

	if (linked_task_ids !== null) {
		await supabase.from('milestone_task_links').delete().eq('milestone_id', milestoneId);
		if (linked_task_ids.length > 0) {
			const { error: le } = await supabase.from('milestone_task_links').insert(
				linked_task_ids.map((tid: string) => ({ milestone_id: milestoneId, task_id: tid }))
			);
			if (le) return { ok: false, status: 500, message: le.message };
		}
	}

	await logActivity(supabase, projectId, `Milestone updated: ${scalarsResult.scalars.title}`, ACTOR_API, {
		amount: scalarsResult.scalars.amount
	});

	return { ok: true };
}

export async function deleteMilestoneViaApi(
	supabase: Db,
	projectId: string,
	milestoneId: string
): Promise<{ ok: false; status: number; message: string } | { ok: true }> {
	const { data: msProj } = await supabase.from('milestones').select('project_id').eq('id', milestoneId).single();
	if (!msProj || msProj.project_id !== projectId) {
		return { ok: false, status: 404, message: 'Milestone not found' };
	}

	const { error } = await (supabase.from('milestones') as any).delete().eq('id', milestoneId);
	if (error) return { ok: false, status: 500, message: error.message };

	await logActivity(supabase, projectId, 'Milestone deleted', ACTOR_API);
	return { ok: true };
}

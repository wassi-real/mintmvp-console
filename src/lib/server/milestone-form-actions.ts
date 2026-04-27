import type { Tables } from '$lib/supabase/types';
import type { RequestEvent } from '@sveltejs/kit';
import { fail, redirect } from '@sveltejs/kit';
import { logActivity, getActorName } from '$lib/server/activity';
import {
	orgUserIdSet,
	parseSlicesJson,
	PRIORITIES,
	PHASES,
	BILL_STATUSES
} from '$lib/server/milestone-shared';

type MilestoneRequest = RequestEvent<{ id: string }>;

export async function createMilestone({ request, locals, params }: MilestoneRequest) {
		const org = await orgUserIdSet(locals.supabase, params.id);
		if (!org) return fail(400, { error: 'Project not found' });

		const form = await request.formData();
		const title = (form.get('title') as string)?.trim();
		const description = (form.get('description') as string)?.trim() || '';
		const estimate = (form.get('estimate') as string)?.trim() || '';
		const due_date = (form.get('due_date') as string)?.trim() || null;
		let priority = (form.get('priority') as string) || 'p3_normal';
		let phase = (form.get('phase') as string) || 'discovery';
		const spec_id_raw = (form.get('spec_id') as string)?.trim() || null;
		const owner_user_id_raw = (form.get('owner_user_id') as string)?.trim() || null;
		const approval_owner_raw = (form.get('approval_owner_user_id') as string)?.trim() || null;
		const entry_gate = (form.get('entry_gate') as string)?.trim() || '';
		const exit_gate = (form.get('exit_gate') as string)?.trim() || '';
		const test_gate_required_tests = (form.get('test_gate_required_tests') as string)?.trim() || '';
		const test_gate_pass_threshold = (form.get('test_gate_pass_threshold') as string)?.trim() || '';
		const test_gate_environment = (form.get('test_gate_environment') as string)?.trim() || '';
		const risks_blockers = (form.get('risks_blockers') as string)?.trim() || '';
		const dependencies = (form.get('dependencies') as string)?.trim() || '';
		const deliverables = (form.get('deliverables') as string)?.trim() || '';
		const notes = (form.get('notes') as string)?.trim() || '';
		const slices = parseSlicesJson(form.get('slices_json'), org.allowed);
		const linked_task_ids = form.getAll('linked_task_id').map(String).filter(Boolean);

		const amount = parseFloat(form.get('amount') as string) || 0;
		const status =
			(form.get('status') as string) || ('planned' as Tables<'milestones'>['status']);
		const paid_date = (form.get('paid_date') as string)?.trim() || null;

		const attach_bill = (form.get('attach_bill') as string) === 'yes';
		const bill_amount_raw = form.get('bill_amount') as string;
		const bill_status_raw = (form.get('bill_status') as string)?.trim() || null;

		if (!title) return fail(400, { error: 'Title is required' });
		if (!description) return fail(400, { error: 'Description is required' });
		if (!estimate) return fail(400, { error: 'Estimate is required' });
		if (!due_date) return fail(400, { error: 'Due date is required' });
		if (!entry_gate) return fail(400, { error: 'Entry gate is required' });
		if (!exit_gate) return fail(400, { error: 'Exit / completion gate is required' });
		if (!test_gate_required_tests)
			return fail(400, { error: 'Test gate: required tests is required' });
		if (!test_gate_pass_threshold)
			return fail(400, { error: 'Test gate: pass threshold is required' });
		if (!test_gate_environment)
			return fail(400, { error: 'Test gate: environment is required' });
		if (!approval_owner_raw) return fail(400, { error: 'Approval owner is required' });

		if (!PRIORITIES.includes(priority as (typeof PRIORITIES)[number])) priority = 'p3_normal';
		if (!PHASES.includes(phase as (typeof PHASES)[number])) phase = 'discovery';

		let approval_owner_user_id: string | null =
			approval_owner_raw && org.allowed.has(approval_owner_raw) ? approval_owner_raw : null;
		if (!approval_owner_user_id) return fail(400, { error: 'Invalid approval owner' });

		let spec_id: string | null = spec_id_raw;
		if (spec_id) {
			const { data: specOk } = await locals.supabase
				.from('specs')
				.select('id')
				.eq('id', spec_id)
				.eq('project_id', params.id)
				.maybeSingle();
			if (!specOk) spec_id = null;
		}

		let owner_user_id: string | null =
			owner_user_id_raw && org.allowed.has(owner_user_id_raw) ? owner_user_id_raw : null;

		if (linked_task_ids.length > 0) {
			const { data: taskRows } = await locals.supabase
				.from('tasks')
				.select('id')
				.eq('project_id', params.id)
				.in('id', linked_task_ids);
			const allowedTasks = new Set((taskRows ?? []).map((t: { id: string }) => t.id));
			for (let i = linked_task_ids.length - 1; i >= 0; i--) {
				if (!allowedTasks.has(linked_task_ids[i])) linked_task_ids.splice(i, 1);
			}
		}

		let attach_bill_val = attach_bill;
		let bill_amount: number | null = null;
		let bill_status: (typeof BILL_STATUSES)[number] | null = null;
		if (attach_bill_val) {
			bill_amount = parseFloat(bill_amount_raw);
			if (Number.isNaN(bill_amount) || bill_amount < 0) {
				return fail(400, { error: 'Bill amount must be a valid non-negative number' });
			}
			if (
				!bill_status_raw ||
				!BILL_STATUSES.includes(bill_status_raw as (typeof BILL_STATUSES)[number])
			) {
				return fail(400, { error: 'Bill status is required when a bill is attached' });
			}
			bill_status = bill_status_raw as (typeof BILL_STATUSES)[number];
		} else {
			attach_bill_val = false;
			bill_amount = null;
			bill_status = null;
		}

		const task_id = linked_task_ids[0] ?? null;

		const insertRow = {
			project_id: params.id,
			title,
			description,
			estimate,
			due_date,
			priority,
			phase,
			spec_id,
			owner_user_id,
			approval_owner_user_id,
			entry_gate,
			exit_gate,
			test_gate_required_tests,
			test_gate_pass_threshold,
			test_gate_environment,
			dependencies,
			risks_blockers,
			deliverables,
			notes,
			amount,
			status,
			paid_date: paid_date || null,
			task_id,
			attach_bill: attach_bill_val,
			bill_amount,
			bill_status
		};

		const { data: created, error } = await (locals.supabase.from('milestones') as any)
			.insert(insertRow)
			.select('id')
			.single();

		if (error) return fail(500, { error: error.message });
		const milestoneId = created.id as string;

		if (slices.length > 0) {
			const { error: se } = await locals.supabase.from('milestone_slices').insert(
				slices.map((s, i) => ({
					milestone_id: milestoneId,
					title: s.title,
					notes: s.notes,
					owner_user_id: s.owner_user_id,
					estimate: s.estimate,
					depends_on: s.depends_on,
					status: s.status,
					sort_order: i
				}))
			);
			if (se) return fail(500, { error: se.message });
		}

		if (linked_task_ids.length > 0) {
			const { error: le } = await locals.supabase.from('milestone_task_links').insert(
				linked_task_ids.map((task_id: string) => ({ milestone_id: milestoneId, task_id }))
			);
			if (le) return fail(500, { error: le.message });
		}

		await logActivity(locals.supabase, params.id, `Milestone created: ${title}`, getActorName(locals.session!), {
			amount
		});
		redirect(303, `/projects/${params.id}/milestone?created=1`);
}

export async function updateMilestone({ request, locals, params }: MilestoneRequest) {
		const org = await orgUserIdSet(locals.supabase, params.id);
		if (!org) return fail(400, { error: 'Project not found' });

		const form = await request.formData();
		const id = form.get('id') as string;
		const title = (form.get('title') as string)?.trim();
		const description = (form.get('description') as string)?.trim() || '';
		const estimate = (form.get('estimate') as string)?.trim() || '';
		const due_date = (form.get('due_date') as string)?.trim() || null;
		let priority = (form.get('priority') as string) || 'p3_normal';
		let phase = (form.get('phase') as string) || 'discovery';
		const spec_id_raw = (form.get('spec_id') as string)?.trim() || null;
		const owner_user_id_raw = (form.get('owner_user_id') as string)?.trim() || null;
		const approval_owner_raw = (form.get('approval_owner_user_id') as string)?.trim() || null;
		const entry_gate = (form.get('entry_gate') as string)?.trim() || '';
		const exit_gate = (form.get('exit_gate') as string)?.trim() || '';
		const test_gate_required_tests = (form.get('test_gate_required_tests') as string)?.trim() || '';
		const test_gate_pass_threshold = (form.get('test_gate_pass_threshold') as string)?.trim() || '';
		const test_gate_environment = (form.get('test_gate_environment') as string)?.trim() || '';
		const risks_blockers = (form.get('risks_blockers') as string)?.trim() || '';
		const dependencies = (form.get('dependencies') as string)?.trim() || '';
		const deliverables = (form.get('deliverables') as string)?.trim() || '';
		const notes = (form.get('notes') as string)?.trim() || '';
		const slices = parseSlicesJson(form.get('slices_json'), org.allowed);
		const linked_task_ids = form.getAll('linked_task_id').map(String).filter(Boolean);

		const amount = parseFloat(form.get('amount') as string) || 0;
		const status =
			(form.get('status') as string) || ('planned' as Tables<'milestones'>['status']);
		const paid_date = (form.get('paid_date') as string)?.trim() || null;

		const attach_bill = (form.get('attach_bill') as string) === 'yes';
		const bill_amount_raw = form.get('bill_amount') as string;
		const bill_status_raw = (form.get('bill_status') as string)?.trim() || null;

		if (!id || !title) return fail(400, { error: 'ID and title are required' });
		if (!description) return fail(400, { error: 'Description is required' });
		if (!estimate) return fail(400, { error: 'Estimate is required' });
		if (!due_date) return fail(400, { error: 'Due date is required' });
		if (!entry_gate) return fail(400, { error: 'Entry gate is required' });
		if (!exit_gate) return fail(400, { error: 'Exit / completion gate is required' });
		if (!test_gate_required_tests)
			return fail(400, { error: 'Test gate: required tests is required' });
		if (!test_gate_pass_threshold)
			return fail(400, { error: 'Test gate: pass threshold is required' });
		if (!test_gate_environment)
			return fail(400, { error: 'Test gate: environment is required' });
		if (!approval_owner_raw) return fail(400, { error: 'Approval owner is required' });

		if (!PRIORITIES.includes(priority as (typeof PRIORITIES)[number])) priority = 'p3_normal';
		if (!PHASES.includes(phase as (typeof PHASES)[number])) phase = 'discovery';

		const { data: msProj } = await locals.supabase
			.from('milestones')
			.select('project_id')
			.eq('id', id)
			.single();
		if (!msProj || msProj.project_id !== params.id) {
			return fail(400, { error: 'Milestone not found' });
		}

		let approval_owner_user_id: string | null =
			approval_owner_raw && org.allowed.has(approval_owner_raw) ? approval_owner_raw : null;
		if (!approval_owner_user_id) return fail(400, { error: 'Invalid approval owner' });

		let spec_id: string | null = spec_id_raw;
		if (spec_id) {
			const { data: specOk } = await locals.supabase
				.from('specs')
				.select('id')
				.eq('id', spec_id)
				.eq('project_id', params.id)
				.maybeSingle();
			if (!specOk) spec_id = null;
		}

		let owner_user_id: string | null =
			owner_user_id_raw && org.allowed.has(owner_user_id_raw) ? owner_user_id_raw : null;

		if (linked_task_ids.length > 0) {
			const { data: taskRows } = await locals.supabase
				.from('tasks')
				.select('id')
				.eq('project_id', params.id)
				.in('id', linked_task_ids);
			const allowedTasks = new Set((taskRows ?? []).map((t: { id: string }) => t.id));
			for (let i = linked_task_ids.length - 1; i >= 0; i--) {
				if (!allowedTasks.has(linked_task_ids[i])) linked_task_ids.splice(i, 1);
			}
		}

		let attach_bill_val = attach_bill;
		let bill_amount: number | null = null;
		let bill_status: (typeof BILL_STATUSES)[number] | null = null;
		if (attach_bill_val) {
			bill_amount = parseFloat(bill_amount_raw);
			if (Number.isNaN(bill_amount) || bill_amount < 0) {
				return fail(400, { error: 'Bill amount must be a valid non-negative number' });
			}
			if (
				!bill_status_raw ||
				!BILL_STATUSES.includes(bill_status_raw as (typeof BILL_STATUSES)[number])
			) {
				return fail(400, { error: 'Bill status is required when a bill is attached' });
			}
			bill_status = bill_status_raw as (typeof BILL_STATUSES)[number];
		} else {
			attach_bill_val = false;
			bill_amount = null;
			bill_status = null;
		}

		const task_id = linked_task_ids[0] ?? null;

		const { error } = await (locals.supabase.from('milestones') as any)
			.update({
				title,
				description,
				estimate,
				due_date,
				priority,
				phase,
				spec_id,
				owner_user_id,
				approval_owner_user_id,
				entry_gate,
				exit_gate,
				test_gate_required_tests,
				test_gate_pass_threshold,
				test_gate_environment,
				dependencies,
				risks_blockers,
				deliverables,
				notes,
				amount,
				status,
				paid_date: paid_date || null,
				task_id,
				attach_bill: attach_bill_val,
				bill_amount,
				bill_status
			})
			.eq('id', id);

		if (error) return fail(500, { error: error.message });

		await locals.supabase.from('milestone_slices').delete().eq('milestone_id', id);
		if (slices.length > 0) {
			const { error: se } = await locals.supabase.from('milestone_slices').insert(
				slices.map((s, i) => ({
					milestone_id: id,
					title: s.title,
					notes: s.notes,
					owner_user_id: s.owner_user_id,
					estimate: s.estimate,
					depends_on: s.depends_on,
					status: s.status,
					sort_order: i
				}))
			);
			if (se) return fail(500, { error: se.message });
		}

		await locals.supabase.from('milestone_task_links').delete().eq('milestone_id', id);
		if (linked_task_ids.length > 0) {
			const { error: le } = await locals.supabase.from('milestone_task_links').insert(
				linked_task_ids.map((tid: string) => ({ milestone_id: id, task_id: tid }))
			);
			if (le) return fail(500, { error: le.message });
		}

		await logActivity(locals.supabase, params.id, `Milestone updated: ${title}`, getActorName(locals.session!), {
			amount
		});
		return { success: true };
}

export async function deleteMilestone({ request, locals, params }: MilestoneRequest) {
		const form = await request.formData();
		const id = form.get('id') as string;
		if (!id) return fail(400, { error: 'ID is required' });

		const { data: msProj } = await locals.supabase
			.from('milestones')
			.select('project_id')
			.eq('id', id)
			.single();
		if (!msProj || msProj.project_id !== params.id) {
			return fail(400, { error: 'Milestone not found' });
		}

		const { error } = await (locals.supabase.from('milestones') as any).delete().eq('id', id);
		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, 'Milestone deleted', getActorName(locals.session!));
		return { success: true };
}

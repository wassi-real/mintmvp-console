import type { PageServerLoad, Actions } from './$types';
import type { Tables } from '$lib/supabase/types';
import { fail } from '@sveltejs/kit';
import { logActivity, getActorName } from '$lib/server/activity';

export type MilestoneWithRelations = Tables<'milestones'> & {
	slices: Tables<'milestone_slices'>[];
	linked_task_ids: string[];
};

const PRIORITIES = ['p1_critical', 'p2_high', 'p3_normal', 'p4_low'] as const;
const PHASES = [
	'planned',
	'scoping',
	'in_progress',
	'testing',
	'review',
	'complete',
	'blocked'
] as const;
const SLICE_STATUSES = ['todo', 'in_progress', 'done', 'blocked'] as const;

function parseSlicesJson(raw: unknown): { title: string; status: (typeof SLICE_STATUSES)[number] }[] {
	if (typeof raw !== 'string' || !raw.trim()) return [];
	try {
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		const out: { title: string; status: (typeof SLICE_STATUSES)[number] }[] = [];
		for (const item of parsed) {
			if (!item || typeof item !== 'object') continue;
			const title = String((item as { title?: unknown }).title ?? '').trim();
			if (!title) continue;
			let status = String((item as { status?: unknown }).status ?? 'todo');
			if (!SLICE_STATUSES.includes(status as (typeof SLICE_STATUSES)[number])) status = 'todo';
			out.push({ title, status: status as (typeof SLICE_STATUSES)[number] });
		}
		return out;
	} catch {
		return [];
	}
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const { data: project, error: projErr } = await locals.supabase
		.from('projects')
		.select('organization_id')
		.eq('id', params.id)
		.single();

	if (projErr || !project) {
		return {
			milestones: [] as MilestoneWithRelations[],
			payments: [] as Tables<'payments'>[],
			expenses: [] as Tables<'expenses'>[],
			tasks: [] as { id: string; title: string }[],
			specs: [] as { id: string; title: string }[],
			orgUsers: [] as { id: string; full_name: string }[]
		};
	}

	const orgId = project.organization_id;

	const [
		{ data: milestones },
		{ data: payments },
		{ data: expenses },
		{ data: tasks },
		{ data: specs },
		{ data: orgUsers }
	] = await Promise.all([
		locals.supabase
			.from('milestones')
			.select('*')
			.eq('project_id', params.id)
			.order('created_at', { ascending: false }),
		locals.supabase
			.from('payments')
			.select('*')
			.eq('project_id', params.id)
			.order('paid_at', { ascending: false }),
		locals.supabase
			.from('expenses')
			.select('*')
			.eq('project_id', params.id)
			.order('spent_at', { ascending: false }),
		locals.supabase
			.from('tasks')
			.select('id, title')
			.eq('project_id', params.id)
			.order('title'),
		locals.supabase.from('specs').select('id, title').eq('project_id', params.id).order('title'),
		locals.supabase
			.from('users')
			.select('id, full_name')
			.eq('organization_id', orgId)
			.order('full_name')
	]);

	const msList = (milestones ?? []) as Tables<'milestones'>[];
	const milestoneIds = msList.map((m) => m.id);

	let sliceRows: Tables<'milestone_slices'>[] = [];
	let linkRows: { milestone_id: string; task_id: string }[] = [];

	if (milestoneIds.length > 0) {
		const [{ data: s }, { data: l }] = await Promise.all([
			locals.supabase
				.from('milestone_slices')
				.select('*')
				.in('milestone_id', milestoneIds)
				.order('sort_order'),
			locals.supabase.from('milestone_task_links').select('milestone_id, task_id').in('milestone_id', milestoneIds)
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
		slices: slicesByMs.get(m.id) ?? [],
		linked_task_ids: linksByMs.get(m.id) ?? []
	}));

	return {
		milestones: milestonesWithRelations,
		payments: (payments ?? []) as Tables<'payments'>[],
		expenses: (expenses ?? []) as Tables<'expenses'>[],
		tasks: (tasks ?? []) as { id: string; title: string }[],
		specs: (specs ?? []) as { id: string; title: string }[],
		orgUsers: (orgUsers ?? []) as { id: string; full_name: string }[]
	};
};

export const actions: Actions = {
	createMilestone: async ({ request, locals, params }) => {
		const form = await request.formData();
		const title = (form.get('title') as string)?.trim();
		const description = (form.get('description') as string)?.trim() || '';
		const estimate = (form.get('estimate') as string)?.trim() || '';
		const due_date = (form.get('due_date') as string)?.trim() || null;
		let priority = (form.get('priority') as string) || 'p3_normal';
		let phase = (form.get('phase') as string) || 'planned';
		const spec_id_raw = (form.get('spec_id') as string)?.trim() || null;
		const owner_user_id_raw = (form.get('owner_user_id') as string)?.trim() || null;
		const notes = (form.get('notes') as string)?.trim() || '';
		const slices = parseSlicesJson(form.get('slices_json'));
		const linked_task_ids = form.getAll('linked_task_id').map(String).filter(Boolean);

		const amount = parseFloat(form.get('amount') as string) || 0;
		const status =
			(form.get('status') as string) || ('planned' as Tables<'milestones'>['status']);
		const paid_date = (form.get('paid_date') as string)?.trim() || null;

		if (!title) return fail(400, { error: 'Title is required' });
		if (!description) return fail(400, { error: 'Description is required' });
		if (!estimate) return fail(400, { error: 'Estimate is required' });
		if (!due_date) return fail(400, { error: 'Due date is required' });

		if (!PRIORITIES.includes(priority as (typeof PRIORITIES)[number])) priority = 'p3_normal';
		if (!PHASES.includes(phase as (typeof PHASES)[number])) phase = 'planned';

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

		let owner_user_id: string | null = owner_user_id_raw;
		if (owner_user_id) {
			const { data: proj } = await locals.supabase
				.from('projects')
				.select('organization_id')
				.eq('id', params.id)
				.single();
			if (proj) {
				const { data: uok } = await locals.supabase
					.from('users')
					.select('id')
					.eq('id', owner_user_id)
					.eq('organization_id', proj.organization_id)
					.maybeSingle();
				if (!uok) owner_user_id = null;
			} else owner_user_id = null;
		}

		if (linked_task_ids.length > 0) {
			const { data: taskRows } = await locals.supabase
				.from('tasks')
				.select('id')
				.eq('project_id', params.id)
				.in('id', linked_task_ids);
			const allowed = new Set((taskRows ?? []).map((t) => t.id));
			for (let i = linked_task_ids.length - 1; i >= 0; i--) {
				if (!allowed.has(linked_task_ids[i])) linked_task_ids.splice(i, 1);
			}
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
			notes,
			amount,
			status,
			paid_date: paid_date || null,
			task_id,
			attach_bill: false,
			bill_amount: null,
			bill_status: null
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
					status: s.status,
					sort_order: i
				}))
			);
			if (se) return fail(500, { error: se.message });
		}

		if (linked_task_ids.length > 0) {
			const { error: le } = await locals.supabase.from('milestone_task_links').insert(
				linked_task_ids.map((task_id) => ({ milestone_id: milestoneId, task_id }))
			);
			if (le) return fail(500, { error: le.message });
		}

		await logActivity(locals.supabase, params.id, `Milestone created: ${title}`, getActorName(locals.session!), {
			amount
		});
		return { success: true, milestoneId };
	},

	updateMilestone: async ({ request, locals, params }) => {
		const form = await request.formData();
		const id = form.get('id') as string;
		const title = (form.get('title') as string)?.trim();
		const description = (form.get('description') as string)?.trim() || '';
		const estimate = (form.get('estimate') as string)?.trim() || '';
		const due_date = (form.get('due_date') as string)?.trim() || null;
		let priority = (form.get('priority') as string) || 'p3_normal';
		let phase = (form.get('phase') as string) || 'planned';
		const spec_id_raw = (form.get('spec_id') as string)?.trim() || null;
		const owner_user_id_raw = (form.get('owner_user_id') as string)?.trim() || null;
		const notes = (form.get('notes') as string)?.trim() || '';
		const slices = parseSlicesJson(form.get('slices_json'));
		const linked_task_ids = form.getAll('linked_task_id').map(String).filter(Boolean);

		const amount = parseFloat(form.get('amount') as string) || 0;
		const status =
			(form.get('status') as string) || ('planned' as Tables<'milestones'>['status']);
		const paid_date = (form.get('paid_date') as string)?.trim() || null;

		if (!id || !title) return fail(400, { error: 'ID and title are required' });
		if (!description) return fail(400, { error: 'Description is required' });
		if (!estimate) return fail(400, { error: 'Estimate is required' });
		if (!due_date) return fail(400, { error: 'Due date is required' });

		if (!PRIORITIES.includes(priority as (typeof PRIORITIES)[number])) priority = 'p3_normal';
		if (!PHASES.includes(phase as (typeof PHASES)[number])) phase = 'planned';

		const { data: msProj } = await locals.supabase
			.from('milestones')
			.select('project_id')
			.eq('id', id)
			.single();
		if (!msProj || msProj.project_id !== params.id) {
			return fail(400, { error: 'Milestone not found' });
		}

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

		let owner_user_id: string | null = owner_user_id_raw;
		if (owner_user_id) {
			const { data: proj } = await locals.supabase
				.from('projects')
				.select('organization_id')
				.eq('id', params.id)
				.single();
			if (proj) {
				const { data: uok } = await locals.supabase
					.from('users')
					.select('id')
					.eq('id', owner_user_id)
					.eq('organization_id', proj.organization_id)
					.maybeSingle();
				if (!uok) owner_user_id = null;
			} else owner_user_id = null;
		}

		if (linked_task_ids.length > 0) {
			const { data: taskRows } = await locals.supabase
				.from('tasks')
				.select('id')
				.eq('project_id', params.id)
				.in('id', linked_task_ids);
			const allowed = new Set((taskRows ?? []).map((t) => t.id));
			for (let i = linked_task_ids.length - 1; i >= 0; i--) {
				if (!allowed.has(linked_task_ids[i])) linked_task_ids.splice(i, 1);
			}
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
				notes,
				amount,
				status,
				paid_date: paid_date || null,
				task_id
			})
			.eq('id', id);

		if (error) return fail(500, { error: error.message });

		await locals.supabase.from('milestone_slices').delete().eq('milestone_id', id);
		if (slices.length > 0) {
			const { error: se } = await locals.supabase.from('milestone_slices').insert(
				slices.map((s, i) => ({
					milestone_id: id,
					title: s.title,
					status: s.status,
					sort_order: i
				}))
			);
			if (se) return fail(500, { error: se.message });
		}

		await locals.supabase.from('milestone_task_links').delete().eq('milestone_id', id);
		if (linked_task_ids.length > 0) {
			const { error: le } = await locals.supabase.from('milestone_task_links').insert(
				linked_task_ids.map((tid) => ({ milestone_id: id, task_id: tid }))
			);
			if (le) return fail(500, { error: le.message });
		}

		await logActivity(locals.supabase, params.id, `Milestone updated: ${title}`, getActorName(locals.session!), {
			amount
		});
		return { success: true };
	},

	deleteMilestone: async ({ request, locals, params }) => {
		const form = await request.formData();
		const id = form.get('id') as string;
		if (!id) return fail(400, { error: 'ID is required' });

		const { error } = await (locals.supabase.from('milestones') as any).delete().eq('id', id);
		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, 'Milestone deleted', getActorName(locals.session!));
		return { success: true };
	},

	createPayment: async ({ request, locals, params }) => {
		const form = await request.formData();
		const amount = parseFloat(form.get('amount') as string) || 0;
		const payment_method = (form.get('payment_method') as string) || '';
		const milestone_id = (form.get('milestone_id') as string)?.trim() || null;
		const paid_at = (form.get('paid_at') as string)?.trim() || new Date().toISOString().slice(0, 10);
		const notes = (form.get('notes') as string)?.trim() || '';

		if (amount <= 0) return fail(400, { error: 'Amount must be greater than 0' });

		const { error } = await (locals.supabase.from('payments') as any).insert({
			project_id: params.id,
			amount,
			payment_method,
			milestone_id: milestone_id || null,
			paid_at,
			notes
		});

		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, `Payment recorded: $${amount}`, getActorName(locals.session!), { method: payment_method });
		return { success: true };
	},

	updatePayment: async ({ request, locals, params }) => {
		const form = await request.formData();
		const id = form.get('id') as string;
		const amount = parseFloat(form.get('amount') as string) || 0;
		const payment_method = (form.get('payment_method') as string) || '';
		const milestone_id = (form.get('milestone_id') as string)?.trim() || null;
		const paid_at = (form.get('paid_at') as string)?.trim() || new Date().toISOString().slice(0, 10);
		const notes = (form.get('notes') as string)?.trim() || '';

		if (!id) return fail(400, { error: 'ID is required' });
		if (amount <= 0) return fail(400, { error: 'Amount must be greater than 0' });

		const { error } = await (locals.supabase.from('payments') as any)
			.update({ amount, payment_method, milestone_id: milestone_id || null, paid_at, notes })
			.eq('id', id);

		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, `Payment updated: $${amount}`, getActorName(locals.session!));
		return { success: true };
	},

	deletePayment: async ({ request, locals, params }) => {
		const form = await request.formData();
		const id = form.get('id') as string;
		if (!id) return fail(400, { error: 'ID is required' });

		const { error } = await (locals.supabase.from('payments') as any).delete().eq('id', id);
		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, 'Payment deleted', getActorName(locals.session!));
		return { success: true };
	},

	createExpense: async ({ request, locals, params }) => {
		const form = await request.formData();
		const title = (form.get('title') as string)?.trim();
		const amount = parseFloat(form.get('amount') as string) || 0;
		const category = (form.get('category') as string) || '';
		const spent_at = (form.get('spent_at') as string)?.trim() || new Date().toISOString().slice(0, 10);
		const notes = (form.get('notes') as string)?.trim() || '';

		if (!title) return fail(400, { error: 'Title is required' });

		const { error } = await (locals.supabase.from('expenses') as any).insert({
			project_id: params.id,
			title,
			amount,
			category,
			spent_at,
			notes
		});

		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, `Expense recorded: ${title} $${amount}`, getActorName(locals.session!), { category });
		return { success: true };
	},

	updateExpense: async ({ request, locals, params }) => {
		const form = await request.formData();
		const id = form.get('id') as string;
		const title = (form.get('title') as string)?.trim();
		const amount = parseFloat(form.get('amount') as string) || 0;
		const category = (form.get('category') as string) || '';
		const spent_at = (form.get('spent_at') as string)?.trim() || new Date().toISOString().slice(0, 10);
		const notes = (form.get('notes') as string)?.trim() || '';

		if (!id || !title) return fail(400, { error: 'ID and title are required' });

		const { error } = await (locals.supabase.from('expenses') as any)
			.update({ title, amount, category, spent_at, notes })
			.eq('id', id);

		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, `Expense updated: ${title}`, getActorName(locals.session!));
		return { success: true };
	},

	deleteExpense: async ({ request, locals, params }) => {
		const form = await request.formData();
		const id = form.get('id') as string;
		if (!id) return fail(400, { error: 'ID is required' });

		const { error } = await (locals.supabase.from('expenses') as any).delete().eq('id', id);
		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, 'Expense deleted', getActorName(locals.session!));
		return { success: true };
	}
};

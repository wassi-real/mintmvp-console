import type { PageServerLoad, Actions } from './$types';
import type { Tables } from '$lib/supabase/types';
import { fail } from '@sveltejs/kit';
import { logActivity, getActorName } from '$lib/server/activity';

export const load: PageServerLoad = async ({ locals, params }) => {
	const [{ data: milestones }, { data: payments }, { data: expenses }, { data: tasks }] = await Promise.all([
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
			.order('title')
	]);

	return {
		milestones: (milestones ?? []) as Tables<'milestones'>[],
		payments: (payments ?? []) as Tables<'payments'>[],
		expenses: (expenses ?? []) as Tables<'expenses'>[],
		tasks: (tasks ?? []) as { id: string; title: string }[]
	};
};

export const actions: Actions = {
	createMilestone: async ({ request, locals, params }) => {
		const form = await request.formData();
		const title = (form.get('title') as string)?.trim();
		const description = (form.get('description') as string)?.trim() || '';
		const amount = parseFloat(form.get('amount') as string) || 0;
		const status = (form.get('status') as string) || 'planned';
		const due_date = (form.get('due_date') as string)?.trim() || null;
		const paid_date = (form.get('paid_date') as string)?.trim() || null;
		const notes = (form.get('notes') as string)?.trim() || '';
		const task_id = (form.get('task_id') as string)?.trim() || null;

		if (!title) return fail(400, { error: 'Title is required' });

		const { error } = await (locals.supabase.from('milestones') as any).insert({
			project_id: params.id,
			title,
			description,
			amount,
			status,
			due_date: due_date || null,
			paid_date: paid_date || null,
			notes,
			task_id: task_id || null
		});

		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, `Milestone created: ${title}`, getActorName(locals.session!), { amount });
		return { success: true };
	},

	updateMilestone: async ({ request, locals, params }) => {
		const form = await request.formData();
		const id = form.get('id') as string;
		const title = (form.get('title') as string)?.trim();
		const description = (form.get('description') as string)?.trim() || '';
		const amount = parseFloat(form.get('amount') as string) || 0;
		const status = (form.get('status') as string) || 'planned';
		const due_date = (form.get('due_date') as string)?.trim() || null;
		const paid_date = (form.get('paid_date') as string)?.trim() || null;
		const notes = (form.get('notes') as string)?.trim() || '';
		const task_id = (form.get('task_id') as string)?.trim() || null;

		if (!id || !title) return fail(400, { error: 'ID and title are required' });

		const { error } = await (locals.supabase.from('milestones') as any)
			.update({ title, description, amount, status, due_date: due_date || null, paid_date: paid_date || null, notes, task_id: task_id || null })
			.eq('id', id);

		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, `Milestone updated: ${title}`, getActorName(locals.session!), { amount });
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

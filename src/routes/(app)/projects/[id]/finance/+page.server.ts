import type { PageServerLoad, Actions } from './$types';
import type { Tables } from '$lib/supabase/types';
import { fail } from '@sveltejs/kit';
import { logActivity, getActorName } from '$lib/server/activity';
import { loadFinanceMilestoneSummaries } from '$lib/server/milestone-shared';

export const load: PageServerLoad = async ({ locals, params }) => {
	const { data: project, error: projErr } = await locals.supabase
		.from('projects')
		.select('organization_id')
		.eq('id', params.id)
		.single();

	if (projErr || !project) {
		return {
			milestones: [] as Awaited<ReturnType<typeof loadFinanceMilestoneSummaries>>,
			payments: [] as Tables<'payments'>[],
			expenses: [] as Tables<'expenses'>[]
		};
	}

	const [{ data: payments }, { data: expenses }] = await Promise.all([
		locals.supabase
			.from('payments')
			.select('*')
			.eq('project_id', params.id)
			.order('paid_at', { ascending: false }),
		locals.supabase
			.from('expenses')
			.select('*')
			.eq('project_id', params.id)
			.order('spent_at', { ascending: false })
	]);

	const milestones = await loadFinanceMilestoneSummaries(locals.supabase, params.id);

	return {
		milestones,
		payments: (payments ?? []) as Tables<'payments'>[],
		expenses: (expenses ?? []) as Tables<'expenses'>[]
	};
};

export const actions: Actions = {
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

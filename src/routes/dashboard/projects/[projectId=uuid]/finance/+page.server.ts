import { error, fail } from '@sveltejs/kit';
import { expenseFields, milestoneBillingFields, paymentFields } from '#lib/sections.ts';
import { logActivity } from '#lib/server/activity.ts';
import { projectContext, type ProjectContext } from '#lib/server/context.ts';
import { crudActions, dbMessage, named, VIEW_ONLY } from '#lib/server/crud.ts';
import { milestoneOptions } from '#lib/server/lookups.ts';
import { isUuid, text, validate } from '#lib/server/validate.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const context = await projectContext(event);
	if (!context.canEdit) error(403, 'Finance is only visible to owners and developers.');
	const { supabase, project } = context;
	const id = project.id;

	const [milestones, payments, expenses, choices] = await Promise.all([
		supabase
			.from('milestones')
			.select('id, title, amount, status, paid_date, due_date')
			.eq('project_id', id)
			.order('due_date', { nullsFirst: false }),
		supabase
			.from('payments')
			.select('*')
			.eq('project_id', id)
			.order('paid_at', { ascending: false })
			.limit(500),
		supabase
			.from('expenses')
			.select('*')
			.eq('project_id', id)
			.order('spent_at', { ascending: false })
			.limit(500),
		milestoneOptions(context)
	]);

	return {
		milestones: milestones.data ?? [],
		payments: payments.data ?? [],
		expenses: expenses.data ?? [],
		milestoneChoices: choices
	};
};

const payments = crudActions({
	table: 'payments',
	fields: async (context) => paymentFields({ milestones: await milestoneOptions(context) }),
	noun: 'payment',
	titleField: 'amount',
	after: async (row, context) => {
		// A recorded payment marks its milestone as paid, so the two stay in agreement.
		if (!row.milestone_id) return;
		await context.supabase
			.from('milestones')
			.update({ status: 'paid', paid_date: String(row.paid_at) })
			.eq('id', String(row.milestone_id))
			.eq('project_id', context.project.id);
	}
});

const expenses = crudActions({
	table: 'expenses',
	fields: expenseFields,
	noun: 'expense',
	titleField: 'title'
});

/** Updates only the billing columns of a milestone. */
async function billing(event: Parameters<Actions[string]>[0]) {
	const context: ProjectContext = await projectContext(event);
	if (!context.canEdit) return fail(403, { message: VIEW_ONLY });

	const form = await event.request.formData();
	const id = text(form, 'id');
	if (!isUuid(id)) return fail(400, { message: 'That milestone could not be found.' });

	const result = validate(milestoneBillingFields, form);
	if (!result.ok) return fail(400, result);

	const { data, error: failure } = await context.supabase
		.from('milestones')
		.update(result.values as { amount: number; status: string })
		.eq('id', id)
		.eq('project_id', context.project.id)
		.select('title')
		.maybeSingle();
	if (failure) return fail(400, { message: dbMessage(failure, 'milestone') });
	if (!data) return fail(404, { message: 'That milestone could not be found.' });

	await logActivity(context, `Billing updated for ${data.title}`, { milestone: id });
	return { message: 'Billing saved.' };
}

export const actions: Actions = {
	billing,
	...named('Payment', payments),
	...named('Expense', expenses)
};

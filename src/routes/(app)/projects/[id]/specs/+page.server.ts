import type { PageServerLoad, Actions } from './$types';
import type { Tables } from '$lib/supabase/types';
import { fail } from '@sveltejs/kit';
import { logActivity, getActorName } from '$lib/server/activity';

export const load: PageServerLoad = async ({ locals, params }) => {
	const { data } = await locals.supabase
		.from('specs')
		.select('*')
		.eq('project_id', params.id)
		.order('created_at', { ascending: false });

	return { specs: (data ?? []) as Tables<'specs'>[] };
};

export const actions: Actions = {
	create: async ({ request, locals, params }) => {
		const form = await request.formData();
		const title = (form.get('title') as string)?.trim();
		const summary = (form.get('summary') as string)?.trim() || null;
		const goal = (form.get('goal') as string)?.trim() || null;
		const acceptance_criteria = (form.get('acceptance_criteria') as string)?.trim() || null;
		const edge_cases = (form.get('edge_cases') as string)?.trim() || null;
		const regression_risks = (form.get('regression_risks') as string)?.trim() || null;
		const status = (form.get('status') as string) || 'draft';

		if (!title) return fail(400, { error: 'Title is required' });

		const { error } = await (locals.supabase.from('specs') as any).insert({
			project_id: params.id,
			title,
			summary,
			goal,
			acceptance_criteria,
			edge_cases,
			regression_risks,
			status
		});

		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, `Spec created: ${title}`, getActorName(locals.session!), { spec: title });
		return { success: true };
	},

	update: async ({ request, locals, params }) => {
		const form = await request.formData();
		const id = form.get('id') as string;
		const title = (form.get('title') as string)?.trim();
		const summary = (form.get('summary') as string)?.trim() || null;
		const goal = (form.get('goal') as string)?.trim() || null;
		const acceptance_criteria = (form.get('acceptance_criteria') as string)?.trim() || null;
		const edge_cases = (form.get('edge_cases') as string)?.trim() || null;
		const regression_risks = (form.get('regression_risks') as string)?.trim() || null;
		const status = (form.get('status') as string) || 'draft';

		if (!id || !title) return fail(400, { error: 'ID and title are required' });

		const { error } = await (locals.supabase.from('specs') as any)
			.update({ title, summary, goal, acceptance_criteria, edge_cases, regression_risks, status })
			.eq('id', id);

		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, `Spec updated: ${title}`, getActorName(locals.session!), { spec: title });
		return { success: true };
	},

	delete: async ({ request, locals, params }) => {
		const form = await request.formData();
		const id = form.get('id') as string;
		const title = form.get('title') as string;

		if (!id) return fail(400, { error: 'ID is required' });

		const { error } = await (locals.supabase.from('specs') as any).delete().eq('id', id);

		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, `Spec deleted: ${title}`, getActorName(locals.session!), { spec: title });
		return { success: true };
	}
};

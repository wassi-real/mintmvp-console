import type { PageServerLoad, Actions } from './$types';
import type { Tables } from '$lib/supabase/types';
import { fail } from '@sveltejs/kit';
import { logActivity, getActorName } from '$lib/server/activity';

export const load: PageServerLoad = async ({ locals, params }) => {
	const [{ data: reports }, { data: folders }] = await Promise.all([
		locals.supabase
			.from('reports')
			.select('*')
			.eq('project_id', params.id)
			.order('updated_at', { ascending: false }),
		locals.supabase
			.from('report_folders')
			.select('*')
			.eq('project_id', params.id)
			.order('sort_order', { ascending: true })
			.order('name', { ascending: true })
	]);

	return {
		reports: (reports ?? []) as Tables<'reports'>[],
		folders: (folders ?? []) as Tables<'report_folders'>[]
	};
};

export const actions: Actions = {
	create: async ({ request, locals, params }) => {
		const form = await request.formData();
		const title = (form.get('title') as string)?.trim();
		const content = (form.get('content') as string) ?? '';
		const folder_id_raw = (form.get('folder_id') as string)?.trim() || '';

		if (!title) return fail(400, { error: 'Title is required' });

		let folder_id: string | null = null;
		if (folder_id_raw) {
			const { data: fo } = await locals.supabase
				.from('report_folders')
				.select('id')
				.eq('id', folder_id_raw)
				.eq('project_id', params.id)
				.maybeSingle();
			if (fo) folder_id = folder_id_raw;
		}

		const actor = getActorName(locals.session!);
		const { data, error } = await (locals.supabase.from('reports') as any)
			.insert({ project_id: params.id, folder_id, title, content, created_by: actor })
			.select()
			.single();

		if (error) return fail(500, { error: error.message });

		await logActivity(locals.supabase, params.id, `Report created: ${title}`, actor, { report: title });
		return { success: true, report: data };
	},

	update: async ({ request, locals, params }) => {
		const form = await request.formData();
		const id = form.get('id') as string;
		const title = (form.get('title') as string)?.trim();
		const content = (form.get('content') as string) ?? '';

		if (!id || !title) return fail(400, { error: 'ID and title are required' });

		const { error } = await (locals.supabase.from('reports') as any)
			.update({ title, content })
			.eq('id', id);

		if (error) return fail(500, { error: error.message });

		await logActivity(locals.supabase, params.id, `Report updated: ${title}`, getActorName(locals.session!), { report: title });
		return { success: true };
	},

	delete: async ({ request, locals, params }) => {
		const form = await request.formData();
		const id = form.get('id') as string;
		const title = form.get('title') as string;

		if (!id) return fail(400, { error: 'ID is required' });

		const { error } = await (locals.supabase.from('reports') as any).delete().eq('id', id);

		if (error) return fail(500, { error: error.message });

		await logActivity(locals.supabase, params.id, `Report deleted: ${title}`, getActorName(locals.session!), { report: title });
		return { success: true };
	}
};

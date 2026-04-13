import type { PageServerLoad, Actions } from './$types';
import type { Tables } from '$lib/supabase/types';
import { fail } from '@sveltejs/kit';
import { logActivity, getActorName } from '$lib/server/activity';

export const load: PageServerLoad = async ({ locals, params }) => {
	const [{ data: commits }, { data: branches }, { data: tasks }] = await Promise.all([
		locals.supabase
			.from('code_commits')
			.select('*')
			.eq('project_id', params.id)
			.order('created_at', { ascending: false }),
		locals.supabase
			.from('repo_branches')
			.select('*')
			.eq('project_id', params.id)
			.order('last_activity_at', { ascending: false }),
		locals.supabase
			.from('tasks')
			.select('id, title')
			.eq('project_id', params.id)
			.order('title')
	]);

	return {
		commits: (commits ?? []) as Tables<'code_commits'>[],
		branches: (branches ?? []) as Tables<'repo_branches'>[],
		tasks: (tasks ?? []) as { id: string; title: string }[]
	};
};

export const actions: Actions = {
	createCommit: async ({ request, locals, params }) => {
		const form = await request.formData();
		const branch_name = (form.get('branch_name') as string)?.trim();
		const commit_message = (form.get('commit_message') as string)?.trim();
		const developer_name = (form.get('developer_name') as string)?.trim() || '';
		const status = (form.get('status') as string) || 'draft';
		const task_id = (form.get('task_id') as string)?.trim() || null;

		if (!branch_name || !commit_message) return fail(400, { error: 'Branch name and commit message are required' });

		const { error } = await (locals.supabase.from('code_commits') as any).insert({
			project_id: params.id,
			branch_name,
			commit_message,
			developer_name,
			status,
			task_id: task_id || null
		});

		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, `Code commit: ${commit_message}`, getActorName(locals.session!), { branch: branch_name });
		return { success: true };
	},

	updateCommit: async ({ request, locals, params }) => {
		const form = await request.formData();
		const id = form.get('id') as string;
		const branch_name = (form.get('branch_name') as string)?.trim();
		const commit_message = (form.get('commit_message') as string)?.trim();
		const developer_name = (form.get('developer_name') as string)?.trim() || '';
		const status = (form.get('status') as string) || 'draft';
		const task_id = (form.get('task_id') as string)?.trim() || null;

		if (!id || !branch_name || !commit_message) return fail(400, { error: 'ID, branch name and message are required' });

		const { error } = await (locals.supabase.from('code_commits') as any)
			.update({ branch_name, commit_message, developer_name, status, task_id: task_id || null })
			.eq('id', id);

		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, `Code commit updated: ${commit_message}`, getActorName(locals.session!), { branch: branch_name });
		return { success: true };
	},

	deleteCommit: async ({ request, locals, params }) => {
		const form = await request.formData();
		const id = form.get('id') as string;
		if (!id) return fail(400, { error: 'ID is required' });

		const { error } = await (locals.supabase.from('code_commits') as any).delete().eq('id', id);
		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, 'Code commit deleted', getActorName(locals.session!));
		return { success: true };
	},

	createBranch: async ({ request, locals, params }) => {
		const form = await request.formData();
		const name = (form.get('name') as string)?.trim();
		const status = (form.get('status') as string) || 'stable';

		if (!name) return fail(400, { error: 'Branch name is required' });

		const { error } = await (locals.supabase.from('repo_branches') as any).insert({
			project_id: params.id,
			name,
			status
		});

		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, `Branch created: ${name}`, getActorName(locals.session!));
		return { success: true };
	},

	updateBranch: async ({ request, locals, params }) => {
		const form = await request.formData();
		const id = form.get('id') as string;
		const name = (form.get('name') as string)?.trim();
		const status = (form.get('status') as string) || 'stable';

		if (!id || !name) return fail(400, { error: 'ID and name are required' });

		const { error } = await (locals.supabase.from('repo_branches') as any)
			.update({ name, status, last_activity_at: new Date().toISOString() })
			.eq('id', id);

		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, `Branch updated: ${name}`, getActorName(locals.session!));
		return { success: true };
	},

	deleteBranch: async ({ request, locals, params }) => {
		const form = await request.formData();
		const id = form.get('id') as string;
		if (!id) return fail(400, { error: 'ID is required' });

		const { error } = await (locals.supabase.from('repo_branches') as any).delete().eq('id', id);
		if (error) return fail(500, { error: error.message });
		await logActivity(locals.supabase, params.id, 'Branch deleted', getActorName(locals.session!));
		return { success: true };
	}
};

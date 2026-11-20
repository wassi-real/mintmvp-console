import { error, fail } from '@sveltejs/kit';
import { logActivity } from '#lib/server/activity.ts';
import { projectContext } from '#lib/server/context.ts';
import { VIEW_ONLY } from '#lib/server/crud.ts';
import { sealToken } from '#lib/server/github.ts';
import { text } from '#lib/server/validate.ts';
import type { Actions, PageServerLoad } from './$types';

const REPO = /^[A-Za-z0-9_.-]+$/;

export const load: PageServerLoad = async (event) => {
	const context = await projectContext(event);
	if (!context.canEdit) error(403, 'Integrations are only visible to owners and developers.');
	const { supabase, project } = context;

	const [github, railway, publicPage] = await Promise.all([
		supabase
			.from('project_integrations_github')
			.select('repo_owner, repo_name, access_token, last_sync_at')
			.eq('project_id', project.id)
			.maybeSingle(),
		supabase
			.from('project_integrations_railway')
			.select(
				'railway_project_id, railway_environment_id, railway_service_id, api_token, enabled, last_poll_at, last_poll_error'
			)
			.eq('project_id', project.id)
			.maybeSingle(),
		supabase
			.from('project_monitoring_public')
			.select('token, is_enabled')
			.eq('project_id', project.id)
			.maybeSingle()
	]);

	const gh = github.data;
	const rw = railway.data;
	return {
		github: gh
			? {
					owner: gh.repo_owner,
					repo: gh.repo_name,
					hasToken: Boolean(gh.access_token),
					lastSyncAt: gh.last_sync_at
				}
			: null,
		railway: rw
			? {
					projectId: rw.railway_project_id,
					environmentId: rw.railway_environment_id,
					serviceId: rw.railway_service_id,
					hasToken: Boolean(rw.api_token),
					enabled: rw.enabled,
					lastPollAt: rw.last_poll_at,
					lastPollError: rw.last_poll_error
				}
			: null,
		statusPage: publicPage.data
	};
};

export const actions: Actions = {
	github: async (event) => {
		const context = await projectContext(event);
		if (!context.canEdit) return fail(403, { message: VIEW_ONLY });

		const form = await event.request.formData();
		const owner = text(form, 'repo_owner');
		const repo = text(form, 'repo_name');
		const token = text(form, 'access_token');

		const errors: Record<string, string> = {};
		if (!REPO.test(owner) || owner.length > 100) errors.repo_owner = 'Enter the repository owner.';
		if (!REPO.test(repo) || repo.length > 100) errors.repo_name = 'Enter the repository name.';
		if (token && (token.length < 10 || token.length > 500)) {
			errors.access_token = 'That does not look like a token.';
		}
		if (Object.keys(errors).length) return fail(400, { message: 'Please fix the highlighted fields.', errors });

		const { data: existing } = await context.supabase
			.from('project_integrations_github')
			.select('access_token, installation_id')
			.eq('project_id', context.project.id)
			.maybeSingle();
		if (!token && !existing?.access_token) {
			return fail(400, {
				message: 'Please fix the highlighted fields.',
				errors: { access_token: 'A personal access token is needed to read the repository.' }
			});
		}

		const { error: failure } = await context.supabase.from('project_integrations_github').upsert(
			{
				project_id: context.project.id,
				repo_owner: owner,
				repo_name: repo,
				installation_id: existing?.installation_id ?? '0',
				...(token ? { access_token: sealToken(token) } : {})
			},
			{ onConflict: 'project_id' }
		);
		if (failure) return fail(400, { message: 'Could not save the connection. Please try again.' });

		await logActivity(context, `GitHub connection saved: ${owner}/${repo}`);
		return { message: 'GitHub connection saved.' };
	},

	disconnectGithub: async (event) => {
		const context = await projectContext(event);
		if (!context.canEdit) return fail(403, { message: VIEW_ONLY });
		await context.supabase
			.from('project_integrations_github')
			.delete()
			.eq('project_id', context.project.id);
		await logActivity(context, 'GitHub disconnected');
		return { message: 'GitHub disconnected. Synced data is kept.' };
	},

	railway: async (event) => {
		const context = await projectContext(event);
		if (!context.canEdit) return fail(403, { message: VIEW_ONLY });

		const form = await event.request.formData();
		const projectId = text(form, 'railway_project_id');
		const environmentId = text(form, 'railway_environment_id');
		const serviceId = text(form, 'railway_service_id');
		const token = text(form, 'api_token');
		const enabled = text(form, 'enabled') === 'on';

		const errors: Record<string, string> = {};
		for (const [field, value, label] of [
			['railway_project_id', projectId, 'project'],
			['railway_environment_id', environmentId, 'environment'],
			['railway_service_id', serviceId, 'service']
		] as const) {
			if (!value || value.length > 100) errors[field] = `Enter the Railway ${label} ID.`;
		}
		if (token && (token.length < 10 || token.length > 500)) errors.api_token = 'That does not look like a token.';
		if (Object.keys(errors).length) return fail(400, { message: 'Please fix the highlighted fields.', errors });

		const { data: existing } = await context.supabase
			.from('project_integrations_railway')
			.select('api_token')
			.eq('project_id', context.project.id)
			.maybeSingle();
		if (!token && !existing?.api_token) {
			return fail(400, {
				message: 'Please fix the highlighted fields.',
				errors: { api_token: 'A Railway API token is needed.' }
			});
		}

		const { error: failure } = await context.supabase.from('project_integrations_railway').upsert(
			{
				project_id: context.project.id,
				railway_project_id: projectId,
				railway_environment_id: environmentId,
				railway_service_id: serviceId,
				enabled,
				...(token ? { api_token: token } : {})
			},
			{ onConflict: 'project_id' }
		);
		if (failure) return fail(400, { message: 'Could not save the connection. Please try again.' });

		await logActivity(context, 'Railway connection saved');
		return {
			message: 'Railway connection saved. Log collection runs on its own schedule once it is set up.'
		};
	},

	disconnectRailway: async (event) => {
		const context = await projectContext(event);
		if (!context.canEdit) return fail(403, { message: VIEW_ONLY });
		await context.supabase
			.from('project_integrations_railway')
			.delete()
			.eq('project_id', context.project.id);
		await logActivity(context, 'Railway disconnected');
		return { message: 'Railway disconnected. Collected logs are kept.' };
	}
};

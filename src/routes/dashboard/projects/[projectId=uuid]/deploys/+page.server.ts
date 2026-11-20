import { deploymentFields } from '#lib/sections.ts';
import { projectContext } from '#lib/server/context.ts';
import { crudActions } from '#lib/server/crud.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { supabase, project } = await projectContext(event);
	const id = project.id;

	const [manual, github, logs] = await Promise.all([
		supabase
			.from('deployments')
			.select('*')
			.eq('project_id', id)
			.order('created_at', { ascending: false })
			.limit(200),
		supabase
			.from('github_deployments')
			.select('id, environment, commit_sha, ref, status, created_at, gh_deploy_id')
			.eq('project_id', id)
			.order('created_at', { ascending: false })
			.limit(200),
		supabase
			.from('deploy_log_events')
			.select('id, kind, severity, title, detail, occurred_at, railway_deployment_id')
			.eq('project_id', id)
			.order('occurred_at', { ascending: false })
			.limit(100)
	]);

	const events = logs.data ?? [];
	const problems = events.filter((entry) => entry.severity === 'error').length;

	return {
		deployments: manual.data ?? [],
		github: github.data ?? [],
		events,
		problems
	};
};

export const actions = crudActions({
	table: 'deployments',
	fields: deploymentFields,
	noun: 'deployment',
	titleField: 'version'
});

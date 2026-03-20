import type { PageServerLoad } from './$types';
import type { Tables } from '$lib/supabase/types';

export const load: PageServerLoad = async ({ locals }) => {
	const { supabase } = locals;

	const [projectsRes, tasksRes, testsRes, deploymentsRes, incidentsRes] = await Promise.all([
		supabase.from('projects').select('*').order('created_at', { ascending: false }),
		supabase.from('tasks').select('*'),
		supabase.from('tests').select('*'),
		supabase.from('deployments').select('*').order('created_at', { ascending: false }).limit(5),
		supabase.from('incidents').select('*')
	]);

	const projects = (projectsRes.data ?? []) as Tables<'projects'>[];
	const tasks = (tasksRes.data ?? []) as Tables<'tasks'>[];
	const tests = (testsRes.data ?? []) as Tables<'tests'>[];
	const deployments = (deploymentsRes.data ?? []) as Tables<'deployments'>[];
	const incidents = (incidentsRes.data ?? []) as Tables<'incidents'>[];

	const projectSummaries = projects.map((project) => {
		const projectTasks = tasks.filter((t) => t.project_id === project.id);
		const projectTests = tests.filter((t) => t.project_id === project.id);
		const projectDeploys = deployments.filter((d) => d.project_id === project.id);
		const projectIncidents = incidents.filter((i) => i.project_id === project.id);

		return {
			...project,
			tasksInProgress: projectTasks.filter((t) => t.status === 'in_progress').length,
			tasksInTesting: projectTasks.filter((t) => t.status === 'testing').length,
			totalTasks: projectTasks.length,
			testsPassing: projectTests.every((t) => t.status === 'pass') && projectTests.length > 0,
			testsPassCount: projectTests.filter((t) => t.status === 'pass').length,
			testsTotal: projectTests.length,
			lastDeploy: projectDeploys[0] ?? null,
			openIncidents: projectIncidents.filter((i) => i.status !== 'resolved').length
		};
	});

	return { projectSummaries };
};

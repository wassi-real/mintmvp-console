import type { PageServerLoad } from './$types';
import type { Tables } from '$lib/supabase/types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const { supabase } = locals;
	const projectId = params.id;

	const [
		specsRes,
		tasksRes,
		testsRes,
		incidentsRes,
		activityRes,
		healthRes,
		envsRes,
		commitsRes,
		branchesRes,
		ghIntegrationRes,
		ghPRsRes,
		ghCIRes,
		ghBranchCountRes,
		ghCommitCountRes,
		ghActiveBranchCountRes
	] = await Promise.all([
		supabase.from('specs').select('id, status').eq('project_id', projectId),
		supabase.from('tasks').select('id, status').eq('project_id', projectId),
		supabase.from('tests').select('id, status').eq('project_id', projectId),
		supabase.from('incidents').select('id, status').eq('project_id', projectId),
		supabase
			.from('activity_log')
			.select('*')
			.eq('project_id', projectId)
			.order('created_at', { ascending: false })
			.limit(5),
		supabase.from('project_health').select('*').eq('project_id', projectId).maybeSingle(),
		supabase.from('project_environments').select('*').eq('project_id', projectId).order('kind'),
		supabase.from('code_commits').select('id, status').eq('project_id', projectId),
		supabase.from('repo_branches').select('id, status').eq('project_id', projectId),
		supabase.from('project_integrations_github').select('repo_owner, repo_name, last_sync_at').eq('project_id', projectId).maybeSingle(),
		supabase.from('github_pull_requests').select('id, status').eq('project_id', projectId),
		supabase.from('github_ci_runs').select('id, status').eq('project_id', projectId),
		supabase.from('github_branches').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
		supabase.from('github_commits').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
		supabase
			.from('github_branches')
			.select('id', { count: 'exact', head: true })
			.eq('project_id', projectId)
			.eq('status', 'active')
	]);

	const specs = (specsRes.data ?? []) as any[];
	const tasks = (tasksRes.data ?? []) as any[];
	const tests = (testsRes.data ?? []) as any[];
	const incidents = (incidentsRes.data ?? []) as any[];
	const recentActivity = (activityRes.data ?? []) as Tables<'activity_log'>[];
	const health = healthRes.data as Tables<'project_health'> | null;
	const environments = (envsRes.data ?? []) as Tables<'project_environments'>[];
	const commits = (commitsRes.data ?? []) as any[];
	const branches = (branchesRes.data ?? []) as any[];
	const ghIntegration = ghIntegrationRes.data as { repo_owner: string; repo_name: string; last_sync_at: string | null } | null;
	const ghPRs = (ghPRsRes.data ?? []) as any[];
	const ghCIRuns = (ghCIRes.data ?? []) as any[];

	const ghBranchCount = ghBranchCountRes.count ?? 0;
	const ghCommitCount = ghCommitCountRes.count ?? 0;
	const ghActiveBranchCount = ghActiveBranchCountRes.count ?? 0;

	const useGithubCounts = Boolean(ghIntegration);

	return {
		stats: {
			specs: specs.length,
			totalTasks: tasks.length,
			tasksInProgress: tasks.filter((t) => t.status === 'in_progress').length,
			tasksInTesting: tasks.filter((t) => t.status === 'testing').length,
			tasksDeployed: tasks.filter((t) => t.status === 'deployed').length,
			testsTotal: tests.length,
			testsPassing: tests.filter((t) => t.status === 'pass').length,
			testsFailing: tests.filter((t) => t.status === 'fail').length,
			openIncidents: incidents.filter((i) => i.status !== 'resolved').length,
			totalIncidents: incidents.length,
			commits: useGithubCounts ? ghCommitCount : commits.length,
			commitsMerged: useGithubCounts ? ghPRs.filter((p: any) => p.status === 'merged').length : commits.filter((c) => c.status === 'merged').length,
			branches: useGithubCounts ? ghBranchCount : branches.length,
			branchesStable: useGithubCounts ? ghActiveBranchCount : branches.filter((b) => b.status === 'stable').length,
			ghPRs: ghPRs.length,
			ghPRsOpen: ghPRs.filter((p: any) => p.status === 'open').length,
			ghCIRuns: ghCIRuns.length,
			ghCIPassing: ghCIRuns.filter((r: any) => r.status === 'success').length
		},
		health,
		environments,
		ghIntegration,
		recentActivity
	};
};

import type { PageServerLoad } from './$types';

/** Normalize GitHub deployment ref to comparable branch/tag label */
function refToBranchLabel(ref: string | null | undefined): string {
	if (!ref) return '';
	const r = ref.trim();
	if (r.startsWith('refs/heads/')) return r.slice(11);
	if (r.startsWith('refs/tags/')) return r.slice(10);
	return r;
}

function envIsStaging(env: string): boolean {
	const e = env.toLowerCase();
	return e.includes('stag') || e.includes('preview') || e === 'qa' || e === 'uat';
}

function envIsProduction(env: string): boolean {
	const e = env.toLowerCase();
	if (e.includes('stag') || e.includes('preview') || e === 'qa') return false;
	return e.includes('prod') || e === 'production' || e === 'live';
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const pid = params.id;

	const [
		{ data: specs },
		{ data: tasks },
		{ data: tests },
		{ data: deployments },
		{ data: incidents },
		{ data: health },
		{ data: branches },
		{ data: ciRuns },
		{ data: ghDeployments }
	] = await Promise.all([
		locals.supabase.from('specs').select('id, status').eq('project_id', pid),
		locals.supabase.from('tasks').select('id, status').eq('project_id', pid),
		locals.supabase.from('tests').select('id, status').eq('project_id', pid),
		locals.supabase.from('deployments').select('id, status, environment').eq('project_id', pid).order('created_at', { ascending: false }),
		locals.supabase.from('incidents').select('id, status').eq('project_id', pid),
		locals.supabase.from('project_health').select('*').eq('project_id', pid).maybeSingle(),
		locals.supabase.from('github_branches').select('name, updated_at').eq('project_id', pid).order('name'),
		locals.supabase.from('github_ci_runs').select('id, branch, status').eq('project_id', pid),
		locals.supabase
			.from('github_deployments')
			.select('id, environment, commit_sha, ref, status, created_at')
			.eq('project_id', pid)
			.order('created_at', { ascending: false })
	]);

	const specList = (specs ?? []) as any[];
	const taskList = (tasks ?? []) as any[];
	const testList = (tests ?? []) as any[];
	const deployList = (deployments ?? []) as any[];
	const incidentList = (incidents ?? []) as any[];
	const branchRows = (branches ?? []) as { name: string; updated_at: string }[];
	const branchNames = branchRows.map((b) => b.name);
	const paramBranch = url.searchParams.get('branch')?.trim();

	let selectedBranch = '';
	if (paramBranch && branchNames.includes(paramBranch)) {
		selectedBranch = paramBranch;
	} else if (branchNames.includes('main')) {
		selectedBranch = 'main';
	} else if (branchNames.length > 0) {
		const sorted = [...branchRows].sort(
			(a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
		);
		selectedBranch = sorted[0]?.name ?? branchNames[0] ?? '';
	}

	const ciForBranch = (ciRuns ?? []).filter((r: any) => r.branch === selectedBranch);
	const ghDepAll = (ghDeployments ?? []) as {
		environment: string;
		commit_sha: string;
		ref: string | null;
		status: string;
		created_at: string;
	}[];
	const ghForBranch = ghDepAll.filter((d) => refToBranchLabel(d.ref) === selectedBranch);
	const stagingDeploys = deployList.filter((d) => d.environment === 'staging');
	const prodDeploys = deployList.filter((d) => d.environment === 'production');

	const ghStaging = ghForBranch.filter((d) => envIsStaging(d.environment));
	const ghProd = ghForBranch.filter((d) => envIsProduction(d.environment));

	function deriveStage(items: any[], doneStatuses: string[], activeStatuses: string[]): string {
		if (items.length === 0) return 'empty';
		if (items.every((i) => doneStatuses.includes(i.status))) return 'passed';
		if (items.some((i) => activeStatuses.includes(i.status))) return 'in_progress';
		return 'pending';
	}

	const stages = [
		{
			name: 'Spec',
			status: deriveStage(specList, ['approved', 'completed'], ['draft', 'in_dev']),
			count: specList.length,
			detail: `${specList.filter((s) => s.status === 'approved' || s.status === 'completed').length} approved`
		},
		{
			name: 'Dev',
			status: deriveStage(taskList, ['deployed'], ['in_progress', 'review', 'testing']),
			count: taskList.length,
			detail: `${taskList.filter((t) => t.status === 'deployed').length} deployed`
		},
		{
			name: 'Testing',
			status: (() => {
				if (!selectedBranch) return 'empty';
				if (ciForBranch.length === 0) return 'empty';
				if (ciForBranch.some((t: any) => t.status === 'failure')) return 'failed';
				if (ciForBranch.some((t: any) => t.status === 'pending' || t.status === 'in_progress')) return 'in_progress';
				if (ciForBranch.every((t: any) => t.status === 'success')) return 'passed';
				return 'in_progress';
			})(),
			count: ciForBranch.length,
			detail: selectedBranch
				? `${ciForBranch.filter((t: any) => t.status === 'success').length} success on ${selectedBranch}`
				: 'Select a branch'
		},
		{
			name: 'Staging',
			status: (() => {
				if (ghStaging.length > 0) {
					if (ghStaging[0].status === 'success') return 'passed';
					if (ghStaging[0].status === 'failure') return 'failed';
					return 'in_progress';
				}
				if (stagingDeploys.length === 0) return 'empty';
				if (stagingDeploys[0].status === 'success') return 'passed';
				if (stagingDeploys[0].status === 'failed') return 'failed';
				return 'in_progress';
			})(),
			count: Math.max(ghStaging.length, stagingDeploys.length),
			detail:
				ghStaging.length > 0
					? `GitHub: ${ghStaging[0].environment} (${ghStaging[0].status})`
					: `${stagingDeploys.length} manual deploys`
		},
		{
			name: 'Production',
			status: (() => {
				if (ghProd.length > 0) {
					if (ghProd[0].status === 'success') return 'passed';
					if (ghProd[0].status === 'failure') return 'failed';
					return 'in_progress';
				}
				if (prodDeploys.length === 0) return 'empty';
				if (prodDeploys[0].status === 'success') return 'passed';
				if (prodDeploys[0].status === 'failed') return 'failed';
				return 'in_progress';
			})(),
			count: Math.max(ghProd.length, prodDeploys.length),
			detail:
				ghProd.length > 0
					? `GitHub: ${ghProd[0].environment} (${ghProd[0].status})`
					: `${prodDeploys.length} manual deploys`
		},
		{
			name: 'Monitoring',
			status: (() => {
				if (!health) return 'empty';
				const h = health as any;
				if (h.uptime_status === 'up' && h.error_count === 0) return 'passed';
				if (h.uptime_status === 'down') return 'failed';
				return 'in_progress';
			})(),
			count: incidentList.filter((i) => i.status === 'open').length,
			detail: `${incidentList.filter((i) => i.status === 'open').length} open incidents`
		}
	];

	return { stages, branches: branchNames, selectedBranch };
};

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const pid = params.id;

	const [
		{ data: specs },
		{ data: tasks },
		{ data: tests },
		{ data: deployments },
		{ data: incidents },
		{ data: health }
	] = await Promise.all([
		locals.supabase.from('specs').select('id, status').eq('project_id', pid),
		locals.supabase.from('tasks').select('id, status').eq('project_id', pid),
		locals.supabase.from('tests').select('id, status').eq('project_id', pid),
		locals.supabase.from('deployments').select('id, status, environment').eq('project_id', pid).order('created_at', { ascending: false }),
		locals.supabase.from('incidents').select('id, status').eq('project_id', pid),
		locals.supabase.from('project_health').select('*').eq('project_id', pid).maybeSingle()
	]);

	const specList = (specs ?? []) as any[];
	const taskList = (tasks ?? []) as any[];
	const testList = (tests ?? []) as any[];
	const deployList = (deployments ?? []) as any[];
	const incidentList = (incidents ?? []) as any[];

	function deriveStage(items: any[], doneStatuses: string[], activeStatuses: string[]): string {
		if (items.length === 0) return 'empty';
		if (items.every((i) => doneStatuses.includes(i.status))) return 'passed';
		if (items.some((i) => activeStatuses.includes(i.status))) return 'in_progress';
		return 'pending';
	}

	const stagingDeploys = deployList.filter((d) => d.environment === 'staging');
	const prodDeploys = deployList.filter((d) => d.environment === 'production');

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
				if (testList.length === 0) return 'empty';
				if (testList.some((t) => t.status === 'fail')) return 'failed';
				if (testList.every((t) => t.status === 'pass')) return 'passed';
				return 'in_progress';
			})(),
			count: testList.length,
			detail: `${testList.filter((t) => t.status === 'pass').length} pass, ${testList.filter((t) => t.status === 'fail').length} fail`
		},
		{
			name: 'Staging',
			status: (() => {
				if (stagingDeploys.length === 0) return 'empty';
				if (stagingDeploys[0].status === 'success') return 'passed';
				if (stagingDeploys[0].status === 'failed') return 'failed';
				return 'in_progress';
			})(),
			count: stagingDeploys.length,
			detail: stagingDeploys.length + ' deploys'
		},
		{
			name: 'Production',
			status: (() => {
				if (prodDeploys.length === 0) return 'empty';
				if (prodDeploys[0].status === 'success') return 'passed';
				if (prodDeploys[0].status === 'failed') return 'failed';
				return 'in_progress';
			})(),
			count: prodDeploys.length,
			detail: prodDeploys.length + ' deploys'
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

	return { stages };
};

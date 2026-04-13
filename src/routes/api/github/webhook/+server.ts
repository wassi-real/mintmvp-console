import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createServiceRoleClient } from '$lib/supabase/server';
import { verifyWebhookSignature } from '$lib/server/github/webhook';
import { logActivity } from '$lib/server/activity';

export const POST: RequestHandler = async ({ request }) => {
	const rawBody = await request.text();
	const signature = request.headers.get('x-hub-signature-256');
	const eventType = request.headers.get('x-github-event') ?? '';
	const deliveryId = request.headers.get('x-github-delivery') ?? '';

	let valid: boolean;
	try {
		valid = await verifyWebhookSignature(rawBody, signature);
	} catch {
		return json({ error: 'Webhook verification failed' }, { status: 500 });
	}

	if (!valid) {
		return json({ error: 'Invalid signature' }, { status: 401 });
	}

	const supabase = createServiceRoleClient();

	if (deliveryId) {
		const { data: existing } = await supabase
			.from('github_webhook_events')
			.select('id')
			.eq('delivery_id', deliveryId)
			.maybeSingle();

		if (existing) {
			return json({ ok: true, message: 'duplicate delivery, skipped' });
		}
	}

	let payload: any;
	try {
		payload = JSON.parse(rawBody);
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const installationId = payload.installation?.id;
	if (!installationId) {
		return json({ ok: true, message: 'no installation, skipped' });
	}

	const { data: integration } = await (supabase.from('project_integrations_github') as any)
		.select('project_id, repo_owner, repo_name')
		.eq('installation_id', installationId)
		.maybeSingle();

	if (!integration) {
		return json({ ok: true, message: 'no linked project' });
	}

	const projectId = integration.project_id;

	try {
		switch (eventType) {
			case 'push':
				await handlePush(supabase, projectId, payload);
				break;
			case 'pull_request':
				await handlePullRequest(supabase, projectId, payload);
				break;
			case 'workflow_run':
				await handleWorkflowRun(supabase, projectId, payload);
				break;
			case 'deployment':
				await handleDeployment(supabase, projectId, payload);
				break;
			case 'deployment_status':
				await handleDeploymentStatus(supabase, projectId, payload);
				break;
		}
	} catch (e) {
		console.error(`Webhook handler error (${eventType}):`, e);
	}

	if (deliveryId) {
		await (supabase.from('github_webhook_events') as any).insert({
			delivery_id: deliveryId,
			event_type: eventType,
			payload
		});
	}

	return json({ ok: true });
};

async function handlePush(supabase: any, projectId: string, payload: any) {
	const ref = payload.ref ?? '';
	const branchName = ref.replace('refs/heads/', '');
	if (!branchName) return;

	const headCommit = payload.head_commit;
	const commits = payload.commits ?? [];

	await (supabase.from('github_branches') as any).upsert(
		{
			project_id: projectId,
			name: branchName,
			last_commit_sha: headCommit?.id ?? '',
			last_commit_message: (headCommit?.message ?? '').slice(0, 500),
			updated_at: new Date().toISOString(),
			status: 'active'
		},
		{ onConflict: 'project_id,name' }
	);

	if (commits.length) {
		const rows = commits.map((c: any) => ({
			project_id: projectId,
			sha: c.id,
			branch: branchName,
			message: (c.message ?? '').slice(0, 500),
			author: c.author?.name ?? c.author?.username ?? '',
			committed_at: c.timestamp ?? new Date().toISOString()
		}));
		await (supabase.from('github_commits') as any).upsert(rows, { onConflict: 'project_id,sha' });
	}

	await logActivity(supabase, projectId, `Push to ${branchName}: ${commits.length} commit(s)`, 'GitHub');
}

async function handlePullRequest(supabase: any, projectId: string, payload: any) {
	const pr = payload.pull_request;
	if (!pr) return;

	const status = pr.merged_at ? 'merged' : pr.state === 'closed' ? 'closed' : 'open';

	await (supabase.from('github_pull_requests') as any).upsert(
		{
			project_id: projectId,
			gh_number: pr.number,
			title: pr.title,
			branch: pr.head?.ref ?? '',
			status,
			author: pr.user?.login ?? '',
			created_at: pr.created_at,
			merged_at: pr.merged_at ?? null
		},
		{ onConflict: 'project_id,gh_number' }
	);

	await logActivity(supabase, projectId, `PR #${pr.number} ${payload.action}: ${pr.title}`, 'GitHub');
}

async function handleWorkflowRun(supabase: any, projectId: string, payload: any) {
	const run = payload.workflow_run;
	if (!run) return;

	const statusMap: Record<string, string> = {
		completed: run.conclusion === 'success' ? 'success' : run.conclusion === 'failure' ? 'failure' : 'cancelled',
		in_progress: 'in_progress',
		queued: 'pending',
		requested: 'pending'
	};

	await (supabase.from('github_ci_runs') as any).upsert(
		{
			project_id: projectId,
			gh_run_id: run.id,
			workflow_name: run.name ?? '',
			branch: run.head_branch ?? '',
			commit_sha: run.head_sha ?? '',
			status: statusMap[run.status] ?? 'pending',
			created_at: run.created_at
		},
		{ onConflict: 'project_id,gh_run_id' }
	);

	await logActivity(supabase, projectId, `CI run ${run.name}: ${run.conclusion ?? run.status}`, 'GitHub');
}

async function handleDeployment(supabase: any, projectId: string, payload: any) {
	const deploy = payload.deployment;
	if (!deploy) return;

	await (supabase.from('github_deployments') as any).upsert(
		{
			project_id: projectId,
			gh_deploy_id: deploy.id,
			environment: deploy.environment ?? 'production',
			commit_sha: deploy.sha ?? '',
			status: 'pending',
			created_at: deploy.created_at
		},
		{ onConflict: 'project_id,gh_deploy_id' }
	);

	await logActivity(supabase, projectId, `Deployment to ${deploy.environment}`, 'GitHub');
}

async function handleDeploymentStatus(supabase: any, projectId: string, payload: any) {
	const status = payload.deployment_status;
	const deploy = payload.deployment;
	if (!status || !deploy) return;

	const stateMap: Record<string, string> = {
		success: 'success',
		failure: 'failure',
		error: 'failure',
		inactive: 'inactive',
		pending: 'pending',
		in_progress: 'pending',
		queued: 'pending'
	};

	await (supabase.from('github_deployments') as any).upsert(
		{
			project_id: projectId,
			gh_deploy_id: deploy.id,
			environment: deploy.environment ?? 'production',
			commit_sha: deploy.sha ?? '',
			status: stateMap[status.state] ?? 'pending',
			created_at: deploy.created_at
		},
		{ onConflict: 'project_id,gh_deploy_id' }
	);

	await logActivity(supabase, projectId, `Deploy ${deploy.environment}: ${status.state}`, 'GitHub');
}

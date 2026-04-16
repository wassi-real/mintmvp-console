<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import {
		HeartPulse,
		AlertCircle,
		CheckCircle,
		XCircle,
		Pencil,
		Loader,
		Globe,
		Copy,
		Link2,
		Plus,
		Trash2,
		Play,
		Download,
		Github,
		ExternalLink
	} from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data, form } = $props();

	let publishSubmitting = $state(false);
	let unpublishSubmitting = $state(false);
	let rotateSubmitting = $state(false);
	let copyHint = $state('');

	const formPublicUrl = $derived(
		form && typeof (form as { publicUrl?: string }).publicUrl === 'string'
			? (form as { publicUrl: string }).publicUrl
			: null
	);
	const formFlash = $derived(
		form && typeof (form as { alreadyLive?: boolean }).alreadyLive === 'boolean' && (form as { alreadyLive: boolean }).alreadyLive
			? 'This page is already public at the URL below.'
			: form && (form as { unpublished?: boolean }).unpublished === true
				? 'Public access is off. The old link returns 404 until you publish again.'
				: ''
	);
	const formError = $derived(
		form && typeof (form as { error?: string }).error === 'string' ? (form as { error: string }).error : ''
	);

	async function copyText(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copyHint = 'Copied';
			setTimeout(() => (copyHint = ''), 2000);
		} catch {
			copyHint = 'Copy failed';
			setTimeout(() => (copyHint = ''), 2000);
		}
	}

	function timeAgo(dateStr: string | null): string {
		if (!dateStr) return 'Never';
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.floor(hours / 24)}d ago`;
	}

	const statusConfig: Record<string, { color: string; bg: string; icon: any; label: string }> = {
		up: { color: 'text-green-400', bg: 'bg-green-950/30 border-green-600/50', icon: CheckCircle, label: 'Operational' },
		down: { color: 'text-red-400', bg: 'bg-red-950/30 border-red-600/50', icon: XCircle, label: 'Down' },
		degraded: { color: 'text-amber-400', bg: 'bg-amber-950/30 border-amber-600/50', icon: AlertCircle, label: 'Degraded' },
		unknown: { color: 'text-muted-foreground', bg: 'bg-card border-border', icon: HeartPulse, label: 'Unknown' }
	};

	const cfg = $derived(statusConfig[data.health?.uptime_status ?? 'unknown'] ?? statusConfig.unknown);

	let editOpen = $state(false);
	let editItem = $state<any>(null);
	let editSubmitting = $state(false);
	let editError = $state('');

	let targetModalOpen = $state(false);
	let targetEdit = $state<{
		id?: string;
		name: string;
		url: string;
		enabled: boolean;
	} | null>(null);
	let targetSubmitting = $state(false);

	function openEdit() {
		editItem = { ...data.health };
		editError = '';
		editOpen = true;
	}

	function targetNameForRun(targetId: string) {
		return data.monitoringTargets.find((t) => t.id === targetId)?.name ?? targetId.slice(0, 8);
	}

	function openNewTarget() {
		targetEdit = { name: '', url: '', enabled: true };
		targetModalOpen = true;
	}

	function openEditTarget(t: (typeof data.monitoringTargets)[0]) {
		targetEdit = { id: t.id, name: t.name, url: t.url, enabled: t.enabled };
		targetModalOpen = true;
	}

	function githubActionsRunUrl(runId: number): string | null {
		const r = data.githubRepo;
		if (!r) return null;
		return `https://github.com/${encodeURIComponent(r.owner)}/${encodeURIComponent(r.repo)}/actions/runs/${runId}`;
	}

	function githubDeploymentPageUrl(deployId: number): string | null {
		const r = data.githubRepo;
		if (!r) return null;
		return `https://github.com/${encodeURIComponent(r.owner)}/${encodeURIComponent(r.repo)}/deployments/${deployId}`;
	}

	function deployStateTone(state: string): string {
		const s = String(state).toLowerCase();
		if (s === 'success') return 'text-green-400';
		if (s.includes('fail') || s === 'error' || s === 'failure') return 'text-red-400';
		if (s.includes('pend') || s.includes('progress') || s === 'queued' || s === 'in_progress') return 'text-amber-400';
		return 'text-muted-foreground';
	}

	function ciStatusTone(status: string): string {
		const s = String(status).toLowerCase();
		if (s === 'success') return 'text-green-400';
		if (s === 'failure') return 'text-red-400';
		if (s === 'cancelled') return 'text-muted-foreground';
		if (s === 'in_progress' || s === 'pending') return 'text-amber-400';
		return 'text-foreground';
	}
</script>

<div>
	<PageHeader
		title="System Health"
		description="HTTP probes, GitHub deployment feedback, and Actions run logs — together they show whether services are up and running smoothly."
	>
		{#snippet actions()}
			<button onclick={openEdit}
				class="flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90">
				<Pencil size={18} /> Update Status
			</button>
		{/snippet}
	</PageHeader>

	{#if data.canManagePublicMonitoring}
		<div class="mt-8 rounded-xl border border-border bg-card p-6">
			<div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
						<Globe size={20} class="text-muted-foreground" />
					</div>
					<div>
						<h2 class="text-lg font-semibold text-foreground">Public status page</h2>
						<p class="mt-0.5 text-sm text-muted-foreground">
							Anyone with the link can view this project’s monitoring summary (no login). Publishing uses the server
							service role to serve read-only data.
						</p>
					</div>
				</div>
			</div>

			{#if formError}
				<p class="mt-4 rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-300">{formError}</p>
			{/if}
			{#if formFlash}
				<p class="mt-4 rounded-lg border border-border bg-secondary/50 px-4 py-3 text-sm text-foreground">{formFlash}</p>
			{/if}

			{#if data.publicStatusPage?.isEnabled}
				<div class="mt-5 space-y-3">
					<label for="public-monitoring-url" class="block text-xs font-medium uppercase tracking-wide text-muted-foreground"
						>Public URL</label
					>
					<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
						<input
							id="public-monitoring-url"
							readonly
							value={formPublicUrl ?? data.publicStatusPage.url}
							class="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-sm text-foreground"
						/>
						<button
							type="button"
							onclick={() => copyText(formPublicUrl ?? data.publicStatusPage!.url)}
							class="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary/80"
						>
							<Copy size={16} /> Copy
						</button>
					</div>
					{#if copyHint}<p class="text-xs text-muted-foreground">{copyHint}</p>{/if}
					<div class="flex flex-wrap gap-3 pt-2">
						<form
							method="POST"
							action="?/rotatePublicToken"
							use:enhance={() => {
								rotateSubmitting = true;
								return async ({ update }) => {
									await update();
									rotateSubmitting = false;
									await invalidateAll();
								};
							}}
						>
							<button
								type="submit"
								disabled={rotateSubmitting}
								class="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-50"
							>
								<Link2 size={16} /> New secret link
							</button>
						</form>
						<form
							method="POST"
							action="?/unpublishPublic"
							use:enhance={() => {
								unpublishSubmitting = true;
								return async ({ update }) => {
									await update();
									unpublishSubmitting = false;
									await invalidateAll();
								};
							}}
						>
							<button
								type="submit"
								disabled={unpublishSubmitting}
								class="inline-flex items-center gap-2 rounded-lg bg-red-900/25 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-900/40 disabled:opacity-50"
							>
								Stop publishing
							</button>
						</form>
					</div>
				</div>
			{:else if data.publicStatusPage && !data.publicStatusPage.isEnabled}
				<p class="mt-4 text-sm text-muted-foreground">
					Publishing is paused. The previous link returns 404 until you publish again (same URL will work).
				</p>
				<form
					method="POST"
					action="?/publishPublic"
					class="mt-4"
					use:enhance={() => {
						publishSubmitting = true;
						return async ({ update }) => {
							await update();
							publishSubmitting = false;
							await invalidateAll();
						};
					}}
				>
					<button
						type="submit"
						disabled={publishSubmitting}
						class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
					>
						<Globe size={16} /> Publish again
					</button>
				</form>
			{:else}
				<form
					method="POST"
					action="?/publishPublic"
					class="mt-5"
					use:enhance={() => {
						publishSubmitting = true;
						return async ({ update }) => {
							await update();
							publishSubmitting = false;
							await invalidateAll();
						};
					}}
				>
					<button
						type="submit"
						disabled={publishSubmitting}
						class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
					>
						{#if publishSubmitting}
							<Loader size={16} class="animate-spin" /> Deploying…
						{:else}
							<Globe size={16} /> Deploy public status page
						{/if}
					</button>
				</form>
			{/if}
		</div>
	{/if}

	{#if data.canManageTargets}
		<div class="mt-8 rounded-xl border border-border bg-card p-6">
			<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h2 class="text-lg font-semibold text-foreground">HTTP monitoring targets</h2>
					<p class="mt-1 text-sm text-muted-foreground">
						Each URL is probed with GET (10s timeout). Schedule <code class="rounded bg-secondary px-1 font-mono text-xs">POST /api/cron/monitoring-check</code> with header
						<code class="rounded bg-secondary px-1 font-mono text-xs">Authorization: Bearer $MONITORING_CRON_SECRET</code>.
					</p>
				</div>
				<div class="flex flex-wrap gap-2">
					<form
						method="POST"
						action="?/runChecksNow"
						use:enhance={() => {
							targetSubmitting = true;
							return async ({ update }) => {
								await update();
								targetSubmitting = false;
								await invalidateAll();
							};
						}}
					>
						<button
							type="submit"
							disabled={targetSubmitting}
							class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
						>
							<Play size={16} /> Run checks now
						</button>
					</form>
					<form
						method="POST"
						action="?/importFromEnvironments"
						use:enhance={() => {
							targetSubmitting = true;
							return async ({ update }) => {
								await update();
								targetSubmitting = false;
								await invalidateAll();
							};
						}}
					>
						<button
							type="submit"
							disabled={targetSubmitting}
							class="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/80 disabled:opacity-50"
						>
							<Download size={16} /> Import from environments
						</button>
					</form>
					<button
						type="button"
						onclick={openNewTarget}
						class="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary"
					>
						<Plus size={16} /> Add target
					</button>
				</div>
			</div>

			{#if data.monitoringTargets.length === 0}
				<p class="mt-4 text-sm text-muted-foreground">No targets yet. Import from environments or add a URL.</p>
			{:else}
				<div class="mt-4 overflow-x-auto rounded-lg border border-border">
					<table class="w-full text-left text-sm">
						<thead class="border-b border-border bg-secondary/40">
							<tr>
								<th class="px-3 py-2 font-semibold">Name</th>
								<th class="px-3 py-2 font-semibold">URL</th>
								<th class="px-3 py-2 font-semibold">Enabled</th>
								<th class="px-3 py-2 font-semibold"></th>
							</tr>
						</thead>
						<tbody>
							{#each data.monitoringTargets as t}
								<tr class="border-b border-border">
									<td class="px-3 py-2 font-medium text-foreground">{t.name}</td>
									<td class="max-w-[200px] truncate px-3 py-2 font-mono text-xs text-muted-foreground">{t.url}</td>
									<td class="px-3 py-2">{t.enabled ? 'Yes' : 'No'}</td>
									<td class="px-3 py-2 text-right">
										<button
											type="button"
											onclick={() => openEditTarget(t)}
											class="mr-2 text-primary hover:underline">Edit</button
										>
										<form method="POST" action="?/deleteTarget" class="inline" use:enhance={() => {
											return async ({ update }) => { await update(); await invalidateAll(); };
										}}>
											<input type="hidden" name="id" value={t.id} />
											<button type="submit" class="inline-flex items-center gap-1 text-red-400 hover:underline">
												<Trash2 size={14} /> Remove
											</button>
										</form>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}

			{#if data.recentRuns?.length}
				<h3 class="mt-6 text-sm font-semibold text-foreground">Recent check runs</h3>
				<div class="mt-2 max-h-56 overflow-y-auto rounded-lg border border-border text-xs">
					<table class="w-full text-left">
						<thead class="sticky top-0 bg-secondary/80">
							<tr>
								<th class="px-2 py-1.5">Target</th>
								<th class="px-2 py-1.5">Time</th>
								<th class="px-2 py-1.5">OK</th>
								<th class="px-2 py-1.5">HTTP</th>
								<th class="px-2 py-1.5">ms</th>
								<th class="px-2 py-1.5">Error / note</th>
							</tr>
						</thead>
						<tbody>
							{#each data.recentRuns as r}
								<tr class="border-t border-border/60">
									<td class="px-2 py-1">{targetNameForRun(r.target_id)}</td>
									<td class="px-2 py-1 text-muted-foreground">{timeAgo(r.checked_at)}</td>
									<td class="px-2 py-1">{r.ok ? 'yes' : 'no'}</td>
									<td class="px-2 py-1">{r.http_status ?? '—'}</td>
									<td class="px-2 py-1">{r.duration_ms}</td>
									<td class="max-w-[180px] truncate px-2 py-1 text-amber-300/90" title={r.error_message ?? ''}
										>{r.error_message ?? '—'}</td
									>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}

	<div class="mt-8 rounded-xl border border-border bg-card p-6">
		<div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
			<div>
				<h2 class="text-lg font-semibold text-foreground">GitHub deployments</h2>
				<p class="mt-1 max-w-3xl text-sm text-muted-foreground">
					Deployment history is read directly from the GitHub REST API on each page load (list deployments plus the
					latest status per deployment: description, environment URL, and log links when GitHub exposes them). This does
					not depend on webhooks. Optional webhook events appear below when configured.
				</p>
			</div>
			<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
				<Github size={22} class="text-foreground" />
			</div>
		</div>

		{#if data.githubDeploymentLogError && data.githubDeploymentLogSource === 'cached'}
			<p class="mt-3 rounded-lg border border-amber-600/40 bg-amber-950/20 px-3 py-2 text-sm text-amber-200/95">
				Live GitHub fetch failed ({data.githubDeploymentLogError}). Showing the last synced copy from the database instead.
			</p>
		{:else if data.githubDeploymentLogError && !data.githubDeploymentLog?.length}
			<p class="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-foreground">
				{data.githubDeploymentLogError}
			</p>
		{/if}

		<p class="mt-2 text-xs text-muted-foreground">
			Source:
			{#if data.githubDeploymentLogSource === 'live'}
				<span class="text-foreground/90">GitHub API (this request)</span>
			{:else if data.githubDeploymentLogSource === 'cached'}
				<span class="text-foreground/90">Database cache</span> (sync or fallback when live fetch is unavailable)
			{:else}
				<span class="text-foreground/90">—</span>
			{/if}
		</p>

		{#if data.deployLogInsight.shown > 0}
			<div
				class="mt-4 flex flex-wrap gap-4 rounded-lg border border-border bg-secondary/30 px-4 py-3 text-sm text-foreground"
			>
				<span><strong>{data.deployLogInsight.shown}</strong> deployments</span>
				<span class="text-green-400"><strong>{data.deployLogInsight.success}</strong> success</span>
				<span class="text-red-400"><strong>{data.deployLogInsight.failed}</strong> failed / error</span>
				<span class="text-amber-400"><strong>{data.deployLogInsight.inProgress}</strong> in progress / pending</span>
			</div>
		{/if}

		{#if !data.githubDeploymentLog?.length}
			<p class="mt-4 text-sm text-muted-foreground">
				No GitHub deployments returned for this repository yet. If you use GitHub Deployments (API, Actions
				<code class="rounded bg-secondary px-1 text-xs">environment</code>, or similar), they will appear here after they
				exist on GitHub. Connect the repo under project settings if needed, and ensure the app can read repository
				contents and deployments.
			</p>
		{:else}
			<div class="mt-4 max-h-[28rem] overflow-y-auto rounded-lg border border-border text-sm">
				<table class="w-full text-left">
					<thead class="sticky top-0 z-10 bg-secondary/95 backdrop-blur">
						<tr>
							<th class="px-3 py-2">When</th>
							<th class="px-3 py-2">State</th>
							<th class="px-3 py-2">Env</th>
							<th class="hidden px-3 py-2 sm:table-cell">Ref</th>
							<th class="px-3 py-2">SHA</th>
							<th class="hidden px-3 py-2 md:table-cell">By</th>
							<th class="px-3 py-2">Links</th>
						</tr>
					</thead>
					<tbody>
						{#each data.githubDeploymentLog as row}
							<tr class="border-t border-border/60 align-top">
								<td class="whitespace-nowrap px-3 py-2 text-muted-foreground">{timeAgo(row.created_at)}</td>
								<td class="px-3 py-2 font-medium {deployStateTone(row.state)}">{row.state}</td>
								<td class="px-3 py-2">{row.environment}</td>
								<td class="hidden max-w-[120px] truncate px-3 py-2 font-mono text-xs sm:table-cell">{row.ref ?? '—'}</td>
								<td class="px-3 py-2 font-mono text-xs">{(row.commit_sha ?? '').slice(0, 7)}</td>
								<td class="hidden px-3 py-2 text-xs text-muted-foreground md:table-cell">{row.creator_login ?? '—'}</td>
								<td class="px-3 py-2">
									<div class="flex flex-wrap gap-x-2 gap-y-1">
										{#if githubDeploymentPageUrl(row.gh_deploy_id)}
											<a
												href={githubDeploymentPageUrl(row.gh_deploy_id)!}
												target="_blank"
												rel="noopener noreferrer"
												class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
												>Deploy <ExternalLink size={12} /></a
											>
										{/if}
										{#if row.environment_url}
											<a
												href={row.environment_url}
												target="_blank"
												rel="noopener noreferrer"
												class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
												>Environment <ExternalLink size={12} /></a
											>
										{/if}
										{#if row.log_url}
											<a
												href={row.log_url}
												target="_blank"
												rel="noopener noreferrer"
												class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
												>Logs <ExternalLink size={12} /></a
											>
										{/if}
										{#if row.target_url}
											<a
												href={row.target_url}
												target="_blank"
												rel="noopener noreferrer"
												class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
												>Target <ExternalLink size={12} /></a
											>
										{/if}
									</div>
								</td>
							</tr>
							<tr class="border-t border-border/40 bg-secondary/20">
								<td colspan="7" class="px-3 pb-3 pt-0">
									<p class="pt-2 text-xs font-medium text-muted-foreground">Latest status description</p>
									<p class="mt-0.5 text-xs text-foreground/90">{row.description?.trim() ? row.description : '—'}</p>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		{#if data.deploymentObservations?.length}
			<h3 class="mt-8 text-sm font-semibold text-foreground">Webhook deployment events (optional)</h3>
			<p class="mt-1 text-sm text-muted-foreground">
				Real-time rows from <code class="rounded bg-secondary px-1 text-xs">deployment</code> and
				<code class="rounded bg-secondary px-1 text-xs">deployment_status</code> when the GitHub App receives them.
			</p>
			{#if data.deployInsight.shown > 0}
				<div
					class="mt-3 flex flex-wrap gap-4 rounded-lg border border-border bg-secondary/30 px-4 py-3 text-sm text-foreground"
				>
					<span><strong>{data.deployInsight.shown}</strong> recent events</span>
					<span class="text-green-400"><strong>{data.deployInsight.success}</strong> success</span>
					<span class="text-red-400"><strong>{data.deployInsight.failed}</strong> failed / error</span>
					<span class="text-amber-400"><strong>{data.deployInsight.inProgress}</strong> in progress / pending</span>
				</div>
			{/if}
			<div class="mt-3 max-h-[20rem] overflow-y-auto rounded-lg border border-border text-sm">
				<table class="w-full text-left">
					<thead class="sticky top-0 z-10 bg-secondary/95 backdrop-blur">
						<tr>
							<th class="px-3 py-2">When</th>
							<th class="px-3 py-2">State</th>
							<th class="px-3 py-2">Env</th>
							<th class="hidden px-3 py-2 sm:table-cell">Ref</th>
							<th class="px-3 py-2">SHA</th>
							<th class="hidden px-3 py-2 md:table-cell">By</th>
							<th class="px-3 py-2">Links</th>
						</tr>
					</thead>
					<tbody>
						{#each data.deploymentObservations as o}
							<tr class="border-t border-border/60 align-top">
								<td class="whitespace-nowrap px-3 py-2 text-muted-foreground">{timeAgo(o.observed_at)}</td>
								<td class="px-3 py-2 font-medium {deployStateTone(o.state)}">{o.state}</td>
								<td class="px-3 py-2">{o.environment}</td>
								<td class="hidden max-w-[120px] truncate px-3 py-2 font-mono text-xs sm:table-cell">{o.ref ?? '—'}</td>
								<td class="px-3 py-2 font-mono text-xs">{(o.commit_sha ?? '').slice(0, 7)}</td>
								<td class="hidden px-3 py-2 text-xs text-muted-foreground md:table-cell">{o.creator_login ?? '—'}</td>
								<td class="px-3 py-2">
									<div class="flex flex-wrap gap-x-2 gap-y-1">
										{#if githubDeploymentPageUrl(o.gh_deploy_id)}
											<a
												href={githubDeploymentPageUrl(o.gh_deploy_id)!}
												target="_blank"
												rel="noopener noreferrer"
												class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
												>Deploy <ExternalLink size={12} /></a
											>
										{/if}
										{#if o.environment_url}
											<a
												href={o.environment_url}
												target="_blank"
												rel="noopener noreferrer"
												class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
												>Environment <ExternalLink size={12} /></a
											>
										{/if}
										{#if o.log_url}
											<a
												href={o.log_url}
												target="_blank"
												rel="noopener noreferrer"
												class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
												>Logs <ExternalLink size={12} /></a
											>
										{/if}
										{#if o.target_url}
											<a
												href={o.target_url}
												target="_blank"
												rel="noopener noreferrer"
												class="inline-flex items-center gap-1 text-xs text-primary hover:underline"
												>Target <ExternalLink size={12} /></a
											>
										{/if}
									</div>
								</td>
							</tr>
							<tr class="border-t border-border/40 bg-secondary/20">
								<td colspan="7" class="px-3 pb-3 pt-0">
									<p class="pt-2 text-xs font-medium text-muted-foreground">Summary</p>
									<p class="mt-0.5 text-xs text-foreground/90">{o.description ?? '—'}</p>
									{#if o.github_status_detail || o.environment_url || o.log_url}
										<details class="mt-2">
											<summary class="cursor-pointer text-xs font-medium text-primary hover:underline">
												Full GitHub status / feedback
											</summary>
											<div class="mt-2 space-y-2 rounded border border-border/60 bg-background/50 p-3 text-xs">
												{#if o.github_status_detail}
													<pre
														class="max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-foreground/90"
														>{o.github_status_detail}</pre
													>
												{:else}
													<p class="text-muted-foreground">No extended description from GitHub for this event.</p>
												{/if}
											</div>
										</details>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		<h3 class="mt-8 text-sm font-semibold text-foreground">GitHub Actions runs (build and checks)</h3>
		<p class="mt-1 text-sm text-muted-foreground">
			Recent workflow runs synced from GitHub. Open a run for full logs, steps, and artifacts.
		</p>
		{#if !data.recentCiRuns?.length}
			<p class="mt-2 text-sm text-muted-foreground">No CI runs in the database yet (sync GitHub or trigger workflows).</p>
		{:else}
			<div class="mt-3 max-h-72 overflow-y-auto rounded-lg border border-border text-sm">
				<table class="w-full text-left">
					<thead class="sticky top-0 bg-secondary/95">
						<tr>
							<th class="px-3 py-2">When</th>
							<th class="px-3 py-2">Workflow</th>
							<th class="px-3 py-2">Branch</th>
							<th class="px-3 py-2">Status</th>
							<th class="px-3 py-2">SHA</th>
							<th class="px-3 py-2">Logs</th>
						</tr>
					</thead>
					<tbody>
						{#each data.recentCiRuns as run}
							<tr class="border-t border-border/60">
								<td class="whitespace-nowrap px-3 py-1.5 text-muted-foreground">{timeAgo(run.created_at)}</td>
								<td class="max-w-[160px] truncate px-3 py-1.5" title={run.workflow_name}>{run.workflow_name}</td>
								<td class="px-3 py-1.5 font-mono text-xs">{run.branch || '—'}</td>
								<td class="px-3 py-1.5 font-medium {ciStatusTone(run.status)}">{run.status}</td>
								<td class="px-3 py-1.5 font-mono text-xs">{(run.commit_sha ?? '').slice(0, 7)}</td>
								<td class="px-3 py-1.5">
									{#if githubActionsRunUrl(run.gh_run_id)}
										<a
											href={githubActionsRunUrl(run.gh_run_id)!}
											target="_blank"
											rel="noopener noreferrer"
											class="inline-flex items-center gap-1 text-primary hover:underline"
											>View run <ExternalLink size={12} /></a
										>
									{:else}
										<span class="text-xs text-muted-foreground">Connect repo for link</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>

	<!-- Main health card -->
	{#if data.health}
		{@const StatusIcon = cfg.icon}
		<div class="mt-6 rounded-xl border-2 p-8 {cfg.bg}">
			<div class="flex items-center gap-4">
				<StatusIcon size={48} class={cfg.color} />
				<div>
					<h2 class="text-3xl font-bold {cfg.color}">{cfg.label}</h2>
					<p class="mt-1 text-base text-muted-foreground">Last checked: {timeAgo(data.health.last_check_at)}</p>
				</div>
			</div>
		</div>

		<!-- Metrics grid -->
		<div class="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
			<div class="rounded-xl border border-border bg-card p-6 text-center">
				<p class="text-sm font-medium text-muted-foreground">Uptime Status</p>
				<p class="mt-2 text-2xl font-bold text-foreground capitalize">{data.health.uptime_status}</p>
			</div>
			<div class="rounded-xl border border-border bg-card p-6 text-center">
				<p class="text-sm font-medium text-muted-foreground">Errors</p>
				<p class="mt-2 text-2xl font-bold {data.health.error_count > 0 ? 'text-red-400' : 'text-foreground'}">{data.health.error_count}</p>
			</div>
			<div class="rounded-xl border border-border bg-card p-6 text-center">
				<p class="text-sm font-medium text-muted-foreground">Warnings</p>
				<p class="mt-2 text-2xl font-bold {data.health.warning_count > 0 ? 'text-amber-400' : 'text-foreground'}">{data.health.warning_count}</p>
			</div>
			<div class="rounded-xl border border-border bg-card p-6 text-center">
				<p class="text-sm font-medium text-muted-foreground">Open Incidents</p>
				<p class="mt-2 text-2xl font-bold {data.openIncidents > 0 ? 'text-red-400' : 'text-foreground'}">{data.openIncidents}</p>
			</div>
		</div>
	{/if}
</div>

<Modal bind:open={targetModalOpen} title={targetEdit?.id ? 'Edit monitoring target' : 'Add monitoring target'}>
	{#if targetEdit}
		<form
			method="POST"
			action={targetEdit.id ? '?/updateTarget' : '?/createTarget'}
			use:enhance={() => {
				targetSubmitting = true;
				return async ({ result, update }) => {
					await update();
					targetSubmitting = false;
					if (result.type === 'success') {
						targetModalOpen = false;
						await invalidateAll();
					}
				};
			}}
		>
			{#if targetEdit.id}<input type="hidden" name="id" value={targetEdit.id} />{/if}
			<div class="space-y-4">
				<div>
					<label for="mt-name" class="mb-1 block text-sm font-medium">Name</label>
					<input
						id="mt-name"
						name="name"
						required
						bind:value={targetEdit.name}
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
					/>
				</div>
				<div>
					<label for="mt-url" class="mb-1 block text-sm font-medium">URL</label>
					<input
						id="mt-url"
						name="url"
						type="url"
						required
						bind:value={targetEdit.url}
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono"
					/>
				</div>
				{#if targetEdit.id}
					<div>
						<label for="mt-en" class="mb-1 block text-sm font-medium">Enabled</label>
						<select id="mt-en" name="enabled" class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
							<option value="true" selected={targetEdit.enabled}>On</option>
							<option value="false" selected={!targetEdit.enabled}>Off</option>
						</select>
					</div>
				{/if}
			</div>
			<div class="mt-6 flex gap-2">
				<button
					type="submit"
					disabled={targetSubmitting}
					class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
				>
					{targetEdit.id ? 'Save' : 'Create'}
				</button>
				<button type="button" onclick={() => (targetModalOpen = false)} class="rounded-lg bg-secondary px-4 py-2 text-sm">
					Cancel
				</button>
			</div>
		</form>
	{/if}
</Modal>

<Modal bind:open={editOpen} title="Update Health Status">
	{#if editItem}
		<form method="POST" action="?/update" use:enhance={() => { editSubmitting = true; editError = '';
			return async ({ result }) => { editSubmitting = false;
				if (result.type === 'failure') editError = (result.data as any)?.error ?? 'Error';
				else { editOpen = false; await invalidateAll(); }
			};
		}}>
			{#if editError}<div class="mb-4 rounded-lg bg-red-900/30 px-4 py-3 text-base text-red-300">{editError}</div>{/if}
			<input type="hidden" name="id" value={editItem.id} />
			<div class="space-y-4">
				<div>
					<label for="h-status" class="mb-1 block text-base font-medium text-foreground">Uptime Status</label>
					<select id="h-status" name="uptime_status" bind:value={editItem.uptime_status} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground">
						<option value="up">Up</option><option value="degraded">Degraded</option><option value="down">Down</option><option value="unknown">Unknown</option>
					</select>
				</div>
				<div>
					<label for="h-errors" class="mb-1 block text-base font-medium text-foreground">Error Count</label>
					<input id="h-errors" name="error_count" type="number" min="0" bind:value={editItem.error_count} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground" />
				</div>
				<div>
					<label for="h-warnings" class="mb-1 block text-base font-medium text-foreground">Warning Count</label>
					<input id="h-warnings" name="warning_count" type="number" min="0" bind:value={editItem.warning_count} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground" />
				</div>
			</div>
			<div class="mt-6 flex gap-3">
				<button type="submit" disabled={editSubmitting} class="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
					{#if editSubmitting}<Loader size={18} class="animate-spin" />Saving...{:else}Save{/if}
				</button>
				<button type="button" onclick={() => (editOpen = false)} class="rounded-lg bg-secondary px-6 py-3 text-base font-medium text-foreground hover:bg-accent">Cancel</button>
			</div>
		</form>
	{/if}
</Modal>

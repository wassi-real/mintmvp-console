<script lang="ts">
	import PageTitleBar from '$lib/components/PageTitleBar.svelte';
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
		ExternalLink,
		Activity,
		Webhook,
		Workflow
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

	function delay(i: number) {
		return `${Math.min(i, 8) * 40}ms`;
	}

	// "Everything is fine" stays calm: no loud tinted panel when the service is up.
	const statusConfig: Record<string, { tone: string; ring: string; icon: any; label: string }> = {
		up: { tone: 'text-success', ring: 'border-border bg-card', icon: CheckCircle, label: 'Operational' },
		down: { tone: 'text-destructive', ring: 'border-destructive/50 bg-destructive/10', icon: XCircle, label: 'Down' },
		degraded: { tone: 'text-warning', ring: 'border-warning/40 bg-warning/5', icon: AlertCircle, label: 'Degraded' },
		unknown: { tone: 'text-muted-foreground', ring: 'border-border bg-card', icon: HeartPulse, label: 'Unknown' }
	};

	const cfg = $derived(statusConfig[data.health?.uptime_status ?? 'unknown'] ?? statusConfig.unknown);

	const healthMetrics = $derived([
		{
			label: 'Uptime',
			value: data.health?.uptime_status ?? 'unknown',
			tone: cfg.tone,
			sub: `Checked ${timeAgo(data.health?.last_check_at ?? null)}`
		},
		{
			label: 'Errors',
			value: data.health?.error_count ?? 0,
			tone: (data.health?.error_count ?? 0) > 0 ? 'text-destructive' : 'text-foreground',
			sub: 'Reported on this project'
		},
		{
			label: 'Warnings',
			value: data.health?.warning_count ?? 0,
			tone: (data.health?.warning_count ?? 0) > 0 ? 'text-warning' : 'text-foreground',
			sub: 'Reported on this project'
		},
		{
			label: 'Open incidents',
			value: data.openIncidents,
			tone: data.openIncidents > 0 ? 'text-destructive' : 'text-foreground',
			sub: `${data.totalIncidents} all time`
		}
	]);

	const enabledTargets = $derived(data.monitoringTargets.filter((t) => t.enabled).length);
	const failedRuns = $derived(data.recentRuns.filter((r) => !r.ok).length);

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

	/** Runs arrive newest-first, so the first hit is the most recent check for a target. */
	function latestRunFor(targetId: string) {
		return data.recentRuns.find((r) => r.target_id === targetId) ?? null;
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
		if (s === 'success') return 'text-success';
		if (s.includes('fail') || s === 'error' || s === 'failure') return 'text-destructive';
		if (s.includes('pend') || s.includes('progress') || s === 'queued' || s === 'in_progress') return 'text-warning';
		return 'text-muted-foreground';
	}

	function ciStatusTone(status: string): string {
		const s = String(status).toLowerCase();
		if (s === 'success') return 'text-success';
		if (s === 'failure') return 'text-destructive';
		if (s === 'cancelled') return 'text-muted-foreground';
		if (s === 'in_progress' || s === 'pending') return 'text-warning';
		return 'text-foreground';
	}

	const thClass = 'px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground';
	const linkClass = 'inline-flex items-center gap-1 text-xs text-primary hover:underline';
</script>

{#snippet insightStrip(
	insight: { shown: number; success: number; failed: number; inProgress: number },
	unit: string
)}
	<div
		class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-lg border border-border bg-secondary/30 px-4 py-2.5 text-xs text-muted-foreground"
	>
		<span><span class="font-semibold tabular-nums text-foreground">{insight.shown}</span> {unit}</span>
		<span>
			<span class="font-semibold tabular-nums {insight.success > 0 ? 'text-success' : 'text-foreground'}"
				>{insight.success}</span
			> success
		</span>
		<span>
			<span class="font-semibold tabular-nums {insight.failed > 0 ? 'text-destructive' : 'text-foreground'}"
				>{insight.failed}</span
			> failed / error
		</span>
		<span>
			<span class="font-semibold tabular-nums {insight.inProgress > 0 ? 'text-warning' : 'text-foreground'}"
				>{insight.inProgress}</span
			> in progress / pending
		</span>
	</div>
{/snippet}

{#snippet deployLinks(
	deployId: number,
	environmentUrl: string | null,
	logUrl: string | null,
	targetUrl: string | null
)}
	<div class="flex flex-wrap gap-x-2.5 gap-y-1">
		{#if githubDeploymentPageUrl(deployId)}
			<a href={githubDeploymentPageUrl(deployId)!} target="_blank" rel="noopener noreferrer" class={linkClass}>
				Deploy <ExternalLink size={11} />
			</a>
		{/if}
		{#if environmentUrl}
			<a href={environmentUrl} target="_blank" rel="noopener noreferrer" class={linkClass}>
				Environment <ExternalLink size={11} />
			</a>
		{/if}
		{#if logUrl}
			<a href={logUrl} target="_blank" rel="noopener noreferrer" class={linkClass}>
				Logs <ExternalLink size={11} />
			</a>
		{/if}
		{#if targetUrl}
			<a href={targetUrl} target="_blank" rel="noopener noreferrer" class={linkClass}>
				Target <ExternalLink size={11} />
			</a>
		{/if}
	</div>
{/snippet}

<PageTitleBar title="System Health">
	{#snippet meta()}
		{#if data.health?.uptime_status === 'up'}
			<span class="live-dot"></span>
		{/if}
		<span class="inline-flex items-center gap-1.5 font-medium {cfg.tone}">
			<cfg.icon size={14} />
			{cfg.label}
		</span>
		{#if data.health}
			<span aria-hidden="true" class="opacity-40">·</span>
			<span>Checked {timeAgo(data.health.last_check_at)}</span>
		{/if}
		{#if data.openIncidents > 0}
			<span aria-hidden="true" class="opacity-40">·</span>
			<span class="font-medium tabular-nums text-destructive">{data.openIncidents} open incidents</span>
		{/if}
	{/snippet}
	{#snippet actions()}
		<button
			onclick={openEdit}
			class="press inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
		>
			<Pencil size={15} /> Update status
		</button>
	{/snippet}
</PageTitleBar>

<!-- Health overview: status + the numbers that answer "is anything wrong" -->
<div class="rise rounded-xl border p-4 sm:p-5 {cfg.ring}" style:--delay="0ms">
	<div class="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
		<div class="flex items-center gap-3">
			<cfg.icon size={24} class="shrink-0 {cfg.tone}" />
			<div>
				<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current status</p>
				<p class="text-lg font-bold {cfg.tone}">{cfg.label}</p>
			</div>
		</div>
		<p class="max-w-2xl text-xs leading-relaxed text-muted-foreground">
			HTTP probes, GitHub deployment feedback, and Actions run logs — together they show whether services are up and
			running smoothly.
		</p>
	</div>

	{#if data.health}
		<div class="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
			{#each healthMetrics as m (m.label)}
				<div class="rounded-lg border border-border bg-card/60 px-4 py-3">
					<p class="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">{m.label}</p>
					<p class="mt-1 text-xl font-bold capitalize tabular-nums {m.tone}">{m.value}</p>
					<p class="mt-0.5 truncate text-xs text-muted-foreground">{m.sub}</p>
				</div>
			{/each}
		</div>
	{:else}
		<p class="mt-4 text-sm text-muted-foreground">
			No health record yet — use “Update status” to log the first check.
		</p>
	{/if}
</div>

<!-- Public status page -->
{#if data.canManagePublicMonitoring}
	<div class="rise mt-4 rounded-xl border border-border bg-card p-4 sm:p-5" style:--delay="40ms">
		<div class="flex flex-wrap items-start justify-between gap-3">
			<div class="flex min-w-0 items-start gap-3">
				<span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
					<Globe size={17} class="text-muted-foreground" />
				</span>
				<div class="min-w-0">
					<h2 class="text-sm font-semibold text-foreground">Public status page</h2>
					<p class="mt-0.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">
						Anyone with the link can view this project’s monitoring summary (no login). Publishing uses the server
						service role to serve read-only data.
					</p>
				</div>
			</div>
			{#if data.publicStatusPage?.isEnabled}
				<span
					class="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2.5 py-1 text-xs font-medium text-success"
				>
					<span class="live-dot"></span> Live
				</span>
			{:else}
				<span
					class="shrink-0 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground"
					>Not published</span
				>
			{/if}
		</div>

		{#if formError}
			<p class="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
				{formError}
			</p>
		{/if}
		{#if formFlash}
			<p class="mt-4 rounded-lg border border-border bg-secondary/50 px-3 py-2.5 text-xs text-foreground">
				{formFlash}
			</p>
		{/if}

		{#if data.publicStatusPage?.isEnabled}
			<div class="mt-4 space-y-3">
				<label
					for="public-monitoring-url"
					class="block text-xs font-medium uppercase tracking-wide text-muted-foreground">Public URL</label
				>
				<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
					<input
						id="public-monitoring-url"
						readonly
						value={formPublicUrl ?? data.publicStatusPage.url}
						class="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 font-mono text-xs text-foreground"
					/>
					<button
						type="button"
						onclick={() => copyText(formPublicUrl ?? data.publicStatusPage!.url)}
						class="press inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/80"
					>
						<Copy size={15} /> Copy
					</button>
				</div>
				{#if copyHint}<p class="text-xs text-muted-foreground">{copyHint}</p>{/if}
				<div class="flex flex-wrap gap-2 pt-1">
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
							class="press inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
						>
							<Link2 size={15} /> New secret link
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
							class="press inline-flex items-center gap-2 rounded-lg border border-destructive/40 px-3.5 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
						>
							Stop publishing
						</button>
					</form>
				</div>
			</div>
		{:else if data.publicStatusPage && !data.publicStatusPage.isEnabled}
			<p class="mt-4 text-xs text-muted-foreground">
				Publishing is paused. The previous link returns 404 until you publish again (same URL will work).
			</p>
			<form
				method="POST"
				action="?/publishPublic"
				class="mt-3"
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
					class="press inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
				>
					<Globe size={15} /> Publish again
				</button>
			</form>
		{:else}
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
					class="press inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
				>
					{#if publishSubmitting}
						<Loader size={15} class="animate-spin" /> Deploying…
					{:else}
						<Globe size={15} /> Deploy public status page
					{/if}
				</button>
			</form>
		{/if}
	</div>
{/if}

<!-- HTTP monitoring targets -->
{#if data.canManageTargets}
	<div class="rise mt-4 rounded-xl border border-border bg-card p-4 sm:p-5" style:--delay="80ms">
		<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
			<div class="min-w-0">
				<h2 class="flex items-center gap-2 text-sm font-semibold text-foreground">
					<Activity size={15} class="text-muted-foreground" /> HTTP monitoring targets
				</h2>
				<p class="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">
					Each URL is probed with GET (10s timeout). Schedule
					<code class="rounded bg-secondary px-1 font-mono text-xs">POST /api/cron/monitoring-check</code> with header
					<code class="rounded bg-secondary px-1 font-mono text-xs"
						>Authorization: Bearer $MONITORING_CRON_SECRET</code
					>.
				</p>
				<div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
					<span
						><span class="font-semibold tabular-nums text-foreground">{data.monitoringTargets.length}</span> targets</span
					>
					<span><span class="font-semibold tabular-nums text-foreground">{enabledTargets}</span> enabled</span>
					{#if data.recentRuns.length}
						<span>
							<span class="font-semibold tabular-nums {failedRuns > 0 ? 'text-destructive' : 'text-success'}"
								>{failedRuns}</span
							> failed of last {data.recentRuns.length} checks
						</span>
					{/if}
				</div>
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
						class="press inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
					>
						<Play size={15} /> Run checks now
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
						class="press inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/80 disabled:opacity-50"
					>
						<Download size={15} /> Import from environments
					</button>
				</form>
				<button
					type="button"
					onclick={openNewTarget}
					class="press inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3.5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
				>
					<Plus size={15} /> Add target
				</button>
			</div>
		</div>

		{#if data.monitoringTargets.length === 0}
			<p class="mt-4 rounded-lg border border-border bg-secondary/20 px-4 py-6 text-center text-sm text-muted-foreground">
				No targets yet. Import from environments or add a URL.
			</p>
		{:else}
			<div class="mt-4 overflow-x-auto rounded-lg border border-border">
				<table class="w-full text-left text-sm">
					<thead class="border-b border-border bg-secondary/40">
						<tr>
							<th class={thClass}>Target</th>
							<th class={thClass}>Enabled</th>
							<th class={thClass}>Last check</th>
							<th class={thClass}><span class="sr-only">Actions</span></th>
						</tr>
					</thead>
					<tbody>
						{#each data.monitoringTargets as t (t.id)}
							{@const run = latestRunFor(t.id)}
							<tr class="row-hover border-b border-border/60 last:border-0">
								<td class="max-w-[18rem] px-3 py-2.5">
									<p class="truncate font-medium text-foreground">{t.name}</p>
									<p class="truncate font-mono text-xs text-muted-foreground" title={t.url}>{t.url}</p>
								</td>
								<td class="px-3 py-2.5">
									<span class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
										<span class="h-1.5 w-1.5 shrink-0 rounded-full {t.enabled ? 'bg-success' : 'bg-muted-foreground'}"
										></span>
										{t.enabled ? 'On' : 'Off'}
									</span>
								</td>
								<td class="whitespace-nowrap px-3 py-2.5 text-xs">
									{#if !run}
										<span class="text-muted-foreground">Never</span>
									{:else}
										<span class="font-medium tabular-nums {run.ok ? 'text-success' : 'text-destructive'}">
											{run.ok ? 'OK' : 'Failed'}{run.http_status ? ` · ${run.http_status}` : ''}
										</span>
										<span class="text-muted-foreground"> · {timeAgo(run.checked_at)}</span>
									{/if}
								</td>
								<td class="px-3 py-2.5">
									<div class="flex items-center justify-end gap-2">
										<button
											type="button"
											onclick={() => openEditTarget(t)}
											class="press rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
											aria-label="Edit {t.name}"
										>
											<Pencil size={14} />
										</button>
										<form
											method="POST"
											action="?/deleteTarget"
											class="inline-flex"
											use:enhance={() => {
												return async ({ update }) => {
													await update();
													await invalidateAll();
												};
											}}
										>
											<input type="hidden" name="id" value={t.id} />
											<button
												type="submit"
												class="press rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
												aria-label="Remove {t.name}"
											>
												<Trash2 size={14} />
											</button>
										</form>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		{#if data.recentRuns?.length}
			<h3 class="mt-5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Recent check runs</h3>
			<div class="scroll-area mt-2 max-h-56 overflow-auto rounded-lg border border-border">
				<table class="w-full text-left text-xs">
					<thead class="sticky top-0 z-10 bg-secondary/95 backdrop-blur">
						<tr>
							<th class="px-3 py-2 font-medium uppercase tracking-wide text-muted-foreground">Target</th>
							<th class="px-3 py-2 font-medium uppercase tracking-wide text-muted-foreground">Time</th>
							<th class="px-3 py-2 font-medium uppercase tracking-wide text-muted-foreground">OK</th>
							<th class="px-3 py-2 font-medium uppercase tracking-wide text-muted-foreground">HTTP</th>
							<th class="px-3 py-2 font-medium uppercase tracking-wide text-muted-foreground">ms</th>
							<th class="px-3 py-2 font-medium uppercase tracking-wide text-muted-foreground">Error / note</th>
						</tr>
					</thead>
					<tbody>
						{#each data.recentRuns as r (r.id)}
							<tr class="row-hover border-t border-border/60">
								<td class="max-w-[10rem] truncate px-3 py-1.5 text-foreground">{targetNameForRun(r.target_id)}</td>
								<td class="whitespace-nowrap px-3 py-1.5 tabular-nums text-muted-foreground">{timeAgo(r.checked_at)}</td>
								<td class="px-3 py-1.5 font-medium {r.ok ? 'text-success' : 'text-destructive'}">
									{r.ok ? 'yes' : 'no'}
								</td>
								<td class="px-3 py-1.5 tabular-nums text-foreground">{r.http_status ?? '—'}</td>
								<td class="px-3 py-1.5 tabular-nums text-muted-foreground">{r.duration_ms}</td>
								<td class="max-w-[12rem] truncate px-3 py-1.5 text-warning" title={r.error_message ?? ''}>
									{r.error_message ?? '—'}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
{/if}

<!-- GitHub deployments -->
<div class="rise mt-4 rounded-xl border border-border bg-card p-4 sm:p-5" style:--delay="120ms">
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div class="min-w-0">
			<h2 class="flex items-center gap-2 text-sm font-semibold text-foreground">
				<Github size={15} class="text-muted-foreground" /> GitHub deployments
			</h2>
			<p class="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
				Deployment history is read directly from the GitHub REST API on each page load (list deployments plus the latest
				status per deployment: description, environment URL, and log links when GitHub exposes them). This does not
				depend on webhooks. Optional webhook events appear below when configured.
			</p>
		</div>
		<span
			class="shrink-0 rounded-full border border-border bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground"
		>
			{#if data.githubDeploymentLogSource === 'live'}
				Source: GitHub API (this request)
			{:else if data.githubDeploymentLogSource === 'cached'}
				Source: database cache
			{:else}
				Source: —
			{/if}
		</span>
	</div>

	{#if data.githubDeploymentLogError && data.githubDeploymentLogSource === 'cached'}
		<p class="mt-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-xs text-warning">
			Live GitHub fetch failed ({data.githubDeploymentLogError}). Showing the last synced copy from the database instead.
		</p>
	{:else if data.githubDeploymentLogError && !data.githubDeploymentLog?.length}
		<p class="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-xs text-destructive">
			{data.githubDeploymentLogError}
		</p>
	{/if}

	{#if data.deployLogInsight.shown > 0}
		{@render insightStrip(data.deployLogInsight, 'deployments')}
	{/if}

	{#if !data.githubDeploymentLog?.length}
		<p class="mt-4 rounded-lg border border-border bg-secondary/20 px-4 py-5 text-xs leading-relaxed text-muted-foreground">
			No GitHub deployments returned for this repository yet. If you use GitHub Deployments (API, Actions
			<code class="rounded bg-secondary px-1 text-xs">environment</code>, or similar), they will appear here after they
			exist on GitHub. Connect the repo under project settings if needed, and ensure the app can read repository contents
			and deployments.
		</p>
	{:else}
		<div class="scroll-area mt-4 max-h-[28rem] overflow-auto rounded-lg border border-border">
			<table class="w-full text-left text-sm">
				<thead class="sticky top-0 z-10 bg-secondary/95 backdrop-blur">
					<tr>
						<th class={thClass}>When</th>
						<th class={thClass}>State</th>
						<th class={thClass}>Env</th>
						<th class="{thClass} hidden sm:table-cell">Ref</th>
						<th class={thClass}>SHA</th>
						<th class="{thClass} hidden md:table-cell">By</th>
						<th class={thClass}>Links</th>
					</tr>
				</thead>
				<tbody>
					{#each data.githubDeploymentLog as row (row.gh_deploy_id)}
						<tr class="row-hover border-t border-border/60 align-top">
							<td class="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-muted-foreground"
								>{timeAgo(row.created_at)}</td
							>
							<td class="px-3 py-2 text-xs font-medium {deployStateTone(row.state)}">{row.state}</td>
							<td class="px-3 py-2 text-xs text-foreground">{row.environment}</td>
							<td class="hidden max-w-[120px] truncate px-3 py-2 font-mono text-xs text-muted-foreground sm:table-cell"
								>{row.ref ?? '—'}</td
							>
							<td class="px-3 py-2 font-mono text-xs text-foreground">{(row.commit_sha ?? '').slice(0, 7)}</td>
							<td class="hidden px-3 py-2 text-xs text-muted-foreground md:table-cell">{row.creator_login ?? '—'}</td>
							<td class="px-3 py-2">
								{@render deployLinks(row.gh_deploy_id, row.environment_url, row.log_url, row.target_url)}
							</td>
						</tr>
						{#if row.description?.trim()}
							<tr class="border-t border-border/40 bg-secondary/20">
								<td colspan="7" class="px-3 pb-3 pt-2">
									<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
										Latest status description
									</p>
									<p class="mt-0.5 text-xs text-foreground">{row.description}</p>
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<!-- Webhook deployment events -->
{#if data.deploymentObservations?.length}
	<div class="rise mt-4 rounded-xl border border-border bg-card p-4 sm:p-5" style:--delay="160ms">
		<h2 class="flex items-center gap-2 text-sm font-semibold text-foreground">
			<Webhook size={15} class="text-muted-foreground" /> Webhook deployment events
			<span class="text-xs font-normal text-muted-foreground">(optional)</span>
		</h2>
		<p class="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
			Real-time rows from <code class="rounded bg-secondary px-1 text-xs">deployment</code> and
			<code class="rounded bg-secondary px-1 text-xs">deployment_status</code> when the GitHub App receives them.
		</p>

		{#if data.deployInsight.shown > 0}
			{@render insightStrip(data.deployInsight, 'recent events')}
		{/if}

		<div class="scroll-area mt-3 max-h-[20rem] overflow-auto rounded-lg border border-border">
			<table class="w-full text-left text-sm">
				<thead class="sticky top-0 z-10 bg-secondary/95 backdrop-blur">
					<tr>
						<th class={thClass}>When</th>
						<th class={thClass}>State</th>
						<th class={thClass}>Env</th>
						<th class="{thClass} hidden sm:table-cell">Ref</th>
						<th class={thClass}>SHA</th>
						<th class="{thClass} hidden md:table-cell">By</th>
						<th class={thClass}>Links</th>
					</tr>
				</thead>
				<tbody>
					{#each data.deploymentObservations as o (o.id)}
						<tr class="row-hover border-t border-border/60 align-top">
							<td class="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-muted-foreground"
								>{timeAgo(o.observed_at)}</td
							>
							<td class="px-3 py-2 text-xs font-medium {deployStateTone(o.state)}">{o.state}</td>
							<td class="px-3 py-2 text-xs text-foreground">{o.environment}</td>
							<td class="hidden max-w-[120px] truncate px-3 py-2 font-mono text-xs text-muted-foreground sm:table-cell"
								>{o.ref ?? '—'}</td
							>
							<td class="px-3 py-2 font-mono text-xs text-foreground">{(o.commit_sha ?? '').slice(0, 7)}</td>
							<td class="hidden px-3 py-2 text-xs text-muted-foreground md:table-cell">{o.creator_login ?? '—'}</td>
							<td class="px-3 py-2">
								{@render deployLinks(o.gh_deploy_id, o.environment_url, o.log_url, o.target_url)}
							</td>
						</tr>
						<tr class="border-t border-border/40 bg-secondary/20">
							<td colspan="7" class="px-3 pb-3 pt-2">
								<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Summary</p>
								<p class="mt-0.5 text-xs text-foreground">{o.description ?? '—'}</p>
								{#if o.github_status_detail || o.environment_url || o.log_url}
									<details class="mt-2">
										<summary class="cursor-pointer text-xs font-medium text-primary hover:underline">
											Full GitHub status / feedback
										</summary>
										<div class="mt-2 space-y-2 rounded-lg border border-border/60 bg-background/50 p-3">
											{#if o.github_status_detail}
												<pre
													class="max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground">{o.github_status_detail}</pre>
											{:else}
												<p class="text-xs text-muted-foreground">
													No extended description from GitHub for this event.
												</p>
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
	</div>
{/if}

<!-- GitHub Actions runs -->
<div class="rise mt-4 rounded-xl border border-border bg-card p-4 sm:p-5" style:--delay="200ms">
	<h2 class="flex items-center gap-2 text-sm font-semibold text-foreground">
		<Workflow size={15} class="text-muted-foreground" /> GitHub Actions runs
	</h2>
	<p class="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
		Recent workflow runs synced from GitHub (build and checks). Open a run for full logs, steps, and artifacts.
	</p>

	{#if !data.recentCiRuns?.length}
		<p class="mt-3 rounded-lg border border-border bg-secondary/20 px-4 py-5 text-center text-xs text-muted-foreground">
			No CI runs in the database yet (sync GitHub or trigger workflows).
		</p>
	{:else}
		<div class="scroll-area mt-3 max-h-72 overflow-auto rounded-lg border border-border">
			<table class="w-full text-left text-sm">
				<thead class="sticky top-0 z-10 bg-secondary/95 backdrop-blur">
					<tr>
						<th class={thClass}>When</th>
						<th class={thClass}>Workflow</th>
						<th class={thClass}>Branch</th>
						<th class={thClass}>Status</th>
						<th class={thClass}>SHA</th>
						<th class={thClass}>Logs</th>
					</tr>
				</thead>
				<tbody>
					{#each data.recentCiRuns as run (run.gh_run_id)}
						<tr class="row-hover border-t border-border/60">
							<td class="whitespace-nowrap px-3 py-2 text-xs tabular-nums text-muted-foreground"
								>{timeAgo(run.created_at)}</td
							>
							<td class="max-w-[160px] truncate px-3 py-2 text-xs text-foreground" title={run.workflow_name}
								>{run.workflow_name}</td
							>
							<td class="px-3 py-2 font-mono text-xs text-muted-foreground">{run.branch || '—'}</td>
							<td class="px-3 py-2 text-xs font-medium {ciStatusTone(run.status)}">{run.status}</td>
							<td class="px-3 py-2 font-mono text-xs text-foreground">{(run.commit_sha ?? '').slice(0, 7)}</td>
							<td class="px-3 py-2">
								{#if githubActionsRunUrl(run.gh_run_id)}
									<a
										href={githubActionsRunUrl(run.gh_run_id)!}
										target="_blank"
										rel="noopener noreferrer"
										class={linkClass}
									>
										View run <ExternalLink size={11} />
									</a>
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
					<label for="mt-name" class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
						>Name</label
					>
					<input
						id="mt-name"
						name="name"
						required
						bind:value={targetEdit.name}
						class="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground"
					/>
				</div>
				<div>
					<label for="mt-url" class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
						>URL</label
					>
					<input
						id="mt-url"
						name="url"
						type="url"
						required
						bind:value={targetEdit.url}
						class="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 font-mono text-sm text-foreground"
					/>
				</div>
				{#if targetEdit.id}
					<div>
						<label for="mt-en" class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
							>Enabled</label
						>
						<select
							id="mt-en"
							name="enabled"
							class="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground"
						>
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
					class="press inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
				>
					{targetEdit.id ? 'Save' : 'Create'}
				</button>
				<button
					type="button"
					onclick={() => (targetModalOpen = false)}
					class="press rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
				>
					Cancel
				</button>
			</div>
		</form>
	{/if}
</Modal>

<Modal bind:open={editOpen} title="Update Health Status">
	{#if editItem}
		<form
			method="POST"
			action="?/update"
			use:enhance={() => {
				editSubmitting = true;
				editError = '';
				return async ({ result }) => {
					editSubmitting = false;
					if (result.type === 'failure') editError = (result.data as any)?.error ?? 'Error';
					else {
						editOpen = false;
						await invalidateAll();
					}
				};
			}}
		>
			{#if editError}
				<div class="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
					{editError}
				</div>
			{/if}
			<input type="hidden" name="id" value={editItem.id} />
			<div class="space-y-4">
				<div>
					<label for="h-status" class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
						>Uptime status</label
					>
					<select
						id="h-status"
						name="uptime_status"
						bind:value={editItem.uptime_status}
						class="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground"
					>
						<option value="up">Up</option><option value="degraded">Degraded</option><option value="down">Down</option
						><option value="unknown">Unknown</option>
					</select>
				</div>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<label for="h-errors" class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
							>Error count</label
						>
						<input
							id="h-errors"
							name="error_count"
							type="number"
							min="0"
							bind:value={editItem.error_count}
							class="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm tabular-nums text-foreground"
						/>
					</div>
					<div>
						<label
							for="h-warnings"
							class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
							>Warning count</label
						>
						<input
							id="h-warnings"
							name="warning_count"
							type="number"
							min="0"
							bind:value={editItem.warning_count}
							class="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm tabular-nums text-foreground"
						/>
					</div>
				</div>
			</div>
			<div class="mt-6 flex gap-2">
				<button
					type="submit"
					disabled={editSubmitting}
					class="press inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
				>
					{#if editSubmitting}<Loader size={15} class="animate-spin" />Saving...{:else}Save{/if}
				</button>
				<button
					type="button"
					onclick={() => (editOpen = false)}
					class="press rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
					>Cancel</button
				>
			</div>
		</form>
	{/if}
</Modal>

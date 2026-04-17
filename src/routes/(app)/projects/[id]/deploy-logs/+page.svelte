<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import {
		ScrollText,
		AlertTriangle,
		Activity,
		Settings2,
		RefreshCw,
		ExternalLink
	} from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data, form } = $props();

	type Tab = 'stream' | 'events' | 'connection';
	let tab: Tab = $state('stream');

	let saveBusy = $state(false);
	let pollBusy = $state(false);

	/** '' = show all deployments; otherwise filter log stream and events to this Railway deployment id. */
	let selectedDeploymentId = $state('');

	$effect(() => {
		const list = data.railwayDeploymentsList;
		if (selectedDeploymentId && !list.some((d) => d.id === selectedDeploymentId)) {
			selectedDeploymentId = '';
		}
	});

	const filteredLogEntries = $derived(
		selectedDeploymentId
			? data.deployLogEntries.filter((e) => e.railway_deployment_id === selectedDeploymentId)
			: data.deployLogEntries
	);

	const filteredLogEvents = $derived(
		selectedDeploymentId
			? data.deployLogEvents.filter((ev) => ev.railway_deployment_id === selectedDeploymentId)
			: data.deployLogEvents
	);

	/** Bound fields so saved values re-apply from the server after invalidate (plain `value=` can stick stale). */
	let railwayProjectId = $state('');
	let railwayEnvironmentId = $state('');
	let railwayServiceId = $state('');
	let railwayPollingEnabled = $state(true);

	$effect(() => {
		const r = data.railway;
		railwayProjectId = r?.railway_project_id ?? '';
		railwayEnvironmentId = r?.railway_environment_id ?? '';
		railwayServiceId = r?.railway_service_id ?? '';
		railwayPollingEnabled = r ? r.enabled !== false : true;
	});

	function timeAgo(d: string | null) {
		if (!d) return '—';
		const diff = Date.now() - new Date(d).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.floor(hours / 24)}d ago`;
	}

	function severityClass(sev: string | null) {
		const s = (sev ?? '').toLowerCase();
		if (s.includes('error') || s === 'fatal') return 'text-red-400';
		if (s.includes('warn')) return 'text-amber-400';
		return 'text-muted-foreground';
	}

	function eventTone(sev: string) {
		const s = sev.toLowerCase();
		if (s === 'error') return 'text-red-400';
		if (s === 'warn') return 'text-amber-400';
		return 'text-emerald-400/90';
	}

	function truncate(s: string, n: number) {
		const t = s.trim();
		return t.length <= n ? t : `${t.slice(0, n)}…`;
	}

	function deployChipActive(id: string) {
		return selectedDeploymentId === id
			? 'border-primary bg-primary/15 text-foreground ring-1 ring-primary/40'
			: 'border-border bg-secondary/40 text-muted-foreground hover:border-border hover:bg-secondary';
	}

	function deployStatusTone(status: string) {
		const s = status.toUpperCase();
		if (s === 'SUCCESS') return 'text-emerald-400';
		if (s === 'FAILED' || s === 'CRASHED') return 'text-red-400';
		if (s === 'BUILDING' || s === 'DEPLOYING' || s === 'QUEUED' || s === 'WAITING') return 'text-amber-400';
		return 'text-muted-foreground';
	}

	const formError = $derived(
		form && typeof (form as { error?: string }).error === 'string' ? (form as { error: string }).error : ''
	);
	const pollFlash = $derived(
		form && (form as { polled?: boolean }).polled === true
			? `Imported ${(form as { linesInserted: number }).linesInserted} new log lines and ${(form as { eventsInserted: number }).eventsInserted} parsed events.`
			: ''
	);
	const saveFlash = $derived(
		form && (form as { savedRailway?: boolean }).savedRailway === true ? 'Railway settings saved.' : ''
	);
</script>

<div>
	<PageHeader
		title="Deploy logs"
		description="Railway runtime and build logs per deployment: pick a deployment below to filter the stream and parsed events, or view All. Polling ingests recent deployments so each has its own log history."
	/>

	<div class="mt-6 flex flex-wrap gap-2 border-b border-border pb-2">
		<button
			type="button"
			class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors {tab === 'stream'
				? 'bg-secondary text-foreground'
				: 'text-muted-foreground hover:bg-secondary/60'}"
			onclick={() => (tab = 'stream')}
		>
			<ScrollText class="mr-1 inline" size={16} />
			Log stream
		</button>
		<button
			type="button"
			class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors {tab === 'events'
				? 'bg-secondary text-foreground'
				: 'text-muted-foreground hover:bg-secondary/60'}"
			onclick={() => (tab = 'events')}
		>
			<Activity class="mr-1 inline" size={16} />
			Parsed events
		</button>
		<button
			type="button"
			class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors {tab === 'connection'
				? 'bg-secondary text-foreground'
				: 'text-muted-foreground hover:bg-secondary/60'}"
			onclick={() => (tab = 'connection')}
		>
			<Settings2 class="mr-1 inline" size={16} />
			Railway connection
		</button>
	</div>

	{#if data.railwayDeploymentsList.length > 0}
		<div class="mt-5 rounded-xl border border-border bg-card p-4">
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Deployment</p>
					<p class="mt-0.5 text-sm text-muted-foreground">
						Tap a deployment to show only its logs and events on this page. <span class="text-foreground/80">All</span> merges every
						deployment again.
					</p>
				</div>
			</div>
			<div class="mt-3 flex max-w-full flex-wrap gap-2 overflow-x-auto pb-1">
				<button
					type="button"
					class="shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors {deployChipActive('')}"
					onclick={() => (selectedDeploymentId = '')}
				>
					All
				</button>
				{#each data.railwayDeploymentsList as d}
					<button
						type="button"
						class="shrink-0 rounded-full border px-3 py-1.5 text-left text-xs font-medium transition-colors {deployChipActive(d.id)}"
						onclick={() => (selectedDeploymentId = d.id)}
					>
						<span class="font-mono">{d.id.slice(0, 8)}</span>
						<span class={`ml-1.5 font-medium ${deployStatusTone(d.status)}`}>{d.status}</span>
						<span class="ml-1 text-[10px] text-muted-foreground">{timeAgo(d.createdAt)}</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	{#if formError}
		<p class="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-foreground">{formError}</p>
	{/if}
	{#if saveFlash}
		<p class="mt-4 rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground">{saveFlash}</p>
	{/if}
	{#if pollFlash}
		<p class="mt-4 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm text-foreground">{pollFlash}</p>
	{/if}

	{#if tab === 'stream'}
		<div class="mt-6 rounded-xl border border-border bg-card p-5">
			<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 class="text-base font-semibold text-foreground">Railway log lines</h2>
					<p class="mt-1 text-sm text-muted-foreground">
						Runtime deploy logs and build logs (for failed or in-progress deployments). Deduplicated on re-pull.
					</p>
				</div>
				{#if data.canManageRailway}
					<form
						method="POST"
						action="?/pollNow"
						use:enhance={() => {
							pollBusy = true;
							return async ({ update }) => {
								await update();
								pollBusy = false;
								await invalidateAll();
							};
						}}
					>
						<button
							type="submit"
							disabled={pollBusy}
							class="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-medium text-foreground hover:bg-secondary/80 disabled:opacity-50"
						>
							<RefreshCw size={16} class={pollBusy ? 'animate-spin' : ''} />
							Pull logs now
						</button>
					</form>
				{/if}
			</div>

			{#if !data.deployLogEntries.length}
				<p class="mt-6 text-sm text-muted-foreground">
					No log lines yet. Configure Railway under the Connection tab, then pull logs or schedule the cron job below.
				</p>
			{:else if !filteredLogEntries.length}
				<p class="mt-6 text-sm text-muted-foreground">
					No log lines for this deployment yet. Choose <strong class="text-foreground">All</strong> or another deployment, or run
					<strong class="text-foreground">Pull logs now</strong> to ingest more history.
				</p>
			{:else}
				<div class="mt-4 max-h-[32rem] overflow-auto rounded-lg border border-border text-xs">
					<table class="w-full text-left">
						<thead class="sticky top-0 z-10 bg-secondary/95 backdrop-blur">
							<tr>
								<th class="px-2 py-2">Time</th>
								<th class="px-2 py-2">Kind</th>
								<th class="hidden px-2 py-2 sm:table-cell">Deployment</th>
								<th class="px-2 py-2">Sev</th>
								<th class="px-2 py-2">Message</th>
							</tr>
						</thead>
						<tbody>
							{#each filteredLogEntries as e}
								<tr class="border-t border-border/60 align-top">
									<td class="whitespace-nowrap px-2 py-1.5 text-muted-foreground">{timeAgo(e.logged_at)}</td>
									<td class="px-2 py-1.5 font-mono text-[11px]">{e.log_kind}</td>
									<td class="hidden max-w-[120px] truncate px-2 py-1.5 font-mono text-[10px] text-muted-foreground sm:table-cell"
										>{e.railway_deployment_id}</td
									>
									<td class="px-2 py-1.5 font-medium {severityClass(e.severity)}">{e.severity ?? '—'}</td>
									<td class="px-2 py-1.5 text-foreground/90">
										<span title={e.message}>{truncate(e.message, 200)}</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}

	{#if tab === 'events'}
		<div class="mt-6 rounded-xl border border-border bg-card p-5">
			<h2 class="text-base font-semibold text-foreground">Parsed events</h2>
			<p class="mt-1 text-sm text-muted-foreground">
				Heuristics similar to log monitors: error and warning patterns, deploy lifecycle phrases, and common runtime
				readiness lines (for example server listen / startup complete).
			</p>

			{#if !data.deployLogEvents.length}
				<p class="mt-6 text-sm text-muted-foreground">No parsed events yet. Pull logs after new deploy activity.</p>
			{:else if !filteredLogEvents.length}
				<p class="mt-6 text-sm text-muted-foreground">No parsed events for this deployment yet. Try another deployment or All.</p>
			{:else}
				<div class="mt-4 max-h-[28rem] overflow-auto rounded-lg border border-border text-sm">
					<table class="w-full text-left">
						<thead class="sticky top-0 bg-secondary/95">
							<tr>
								<th class="px-3 py-2">When</th>
								<th class="px-3 py-2">Kind</th>
								<th class="px-3 py-2">Severity</th>
								<th class="px-3 py-2">Title</th>
								<th class="px-3 py-2">Detail</th>
							</tr>
						</thead>
						<tbody>
							{#each filteredLogEvents as ev}
								<tr class="border-t border-border/60 align-top">
									<td class="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{timeAgo(ev.occurred_at)}</td>
									<td class="px-3 py-2 font-mono text-xs">{ev.kind}</td>
									<td class="px-3 py-2 text-xs font-medium {eventTone(ev.severity)}">{ev.severity}</td>
									<td class="px-3 py-2 text-xs">{ev.title}</td>
									<td class="max-w-md px-3 py-2 text-xs text-muted-foreground">
										<span title={ev.detail ?? ''}>{truncate(ev.detail ?? '', 240)}</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}

	{#if tab === 'connection'}
		<div class="mt-6 space-y-6">
			<div class="rounded-xl border border-border bg-card p-5">
				<div class="flex items-start gap-3">
					<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary">
						<ScrollText size={22} class="text-foreground" />
					</div>
					<div>
						<h2 class="text-base font-semibold text-foreground">Railway API</h2>
						<p class="mt-1 text-sm text-muted-foreground">
							Paste either a <strong class="text-foreground">personal or workspace token</strong> from
							<code class="rounded bg-secondary px-1 text-xs">railway.com/account/tokens</code> (Bearer), or a
							<strong class="text-foreground">project token</strong> from that Railway project’s token settings (we send it as
							<code class="rounded bg-secondary px-1 text-xs">Project-Access-Token</code> automatically if Bearer is rejected). Then copy
							<strong class="text-foreground">Project</strong>, <strong class="text-foreground">Environment</strong>, and
							<strong class="text-foreground">Service</strong> IDs (Cmd/Ctrl+K → copy IDs).
						</p>
						<a
							href="https://docs.railway.com/guides/public-api"
							target="_blank"
							rel="noopener noreferrer"
							class="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
							>Railway public API docs <ExternalLink size={14} /></a
						>
					</div>
				</div>

				{#if data.railway?.last_poll_error}
					<div class="mt-4 flex gap-2 rounded-lg border border-amber-600/40 bg-amber-950/20 px-3 py-2 text-sm text-amber-100">
						<AlertTriangle size={18} class="mt-0.5 shrink-0 text-amber-400" />
						<div>
							<p class="font-medium">Last poll error</p>
							<p class="mt-1 text-xs opacity-90">{data.railway.last_poll_error}</p>
						</div>
					</div>
				{/if}

				{#if data.railway?.last_poll_at}
					<p class="mt-3 text-xs text-muted-foreground">Last successful poll attempt: {timeAgo(data.railway.last_poll_at)}</p>
				{/if}

				{#if data.canManageRailway}
					<form
						method="POST"
						action="?/saveRailway"
						class="mt-6 space-y-4"
						use:enhance={() => {
							saveBusy = true;
							return async ({ update }) => {
								await update();
								saveBusy = false;
								await invalidateAll();
							};
						}}
					>
						<label class="block">
							<span class="text-xs font-medium uppercase tracking-wide text-muted-foreground">API token</span>
							<input
								type="password"
								name="api_token"
								autocomplete="off"
								placeholder={data.railway?.hasToken ? '•••••••• (leave blank to keep existing)' : 'Railway token'}
								class="mt-1 w-full max-w-xl rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
							/>
						</label>
						<label class="block">
							<span class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Project ID</span>
							<input
								type="text"
								name="railway_project_id"
								required
								bind:value={railwayProjectId}
								class="mt-1 w-full max-w-xl rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground"
							/>
						</label>
						<label class="block">
							<span class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Environment ID</span>
							<input
								type="text"
								name="railway_environment_id"
								required
								bind:value={railwayEnvironmentId}
								class="mt-1 w-full max-w-xl rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground"
							/>
						</label>
						<label class="block">
							<span class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Service ID</span>
							<input
								type="text"
								name="railway_service_id"
								required
								bind:value={railwayServiceId}
								class="mt-1 w-full max-w-xl rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground"
							/>
						</label>
						<label class="flex items-center gap-2 text-sm text-foreground">
							<input
								type="checkbox"
								name="enabled"
								value="on"
								bind:checked={railwayPollingEnabled}
								class="rounded border-border"
							/>
							Enable polling for this project
						</label>
						<button
							type="submit"
							disabled={saveBusy}
							class="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
						>
							Save Railway settings
						</button>
					</form>
				{:else}
					<p class="mt-4 text-sm text-muted-foreground">Only owners and developers can edit Railway credentials.</p>
				{/if}
			</div>

			<div class="rounded-xl border border-dashed border-border bg-secondary/20 p-5 text-sm text-muted-foreground">
				<p class="font-medium text-foreground">Continuous polling</p>
				<p class="mt-2">
					Schedule <code class="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">POST /api/cron/railway-logs</code> with header
					<code class="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs">Authorization: Bearer $MONITORING_CRON_SECRET</code>
					alongside your existing monitoring cron. One secret gates both jobs.
				</p>
			</div>
		</div>
	{/if}
</div>

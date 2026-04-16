<script lang="ts">
	import { HeartPulse, AlertCircle, CheckCircle, XCircle, Github, ExternalLink } from 'lucide-svelte';

	let { data } = $props();

	function timeAgo(dateStr: string | null): string {
		if (!dateStr) return 'Never';
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.floor(hours / 24)}d ago`;
	}

	const statusConfig: Record<string, { color: string; bg: string; icon: typeof HeartPulse; label: string }> = {
		up: { color: 'text-green-400', bg: 'bg-green-950/40 border-green-600/50', icon: CheckCircle, label: 'Operational' },
		down: { color: 'text-red-400', bg: 'bg-red-950/40 border-red-600/50', icon: XCircle, label: 'Down' },
		degraded: { color: 'text-amber-400', bg: 'bg-amber-950/40 border-amber-600/50', icon: AlertCircle, label: 'Degraded' },
		unknown: { color: 'text-zinc-400', bg: 'bg-zinc-900/50 border-zinc-700', icon: HeartPulse, label: 'Unknown' }
	};

	const cfg = $derived(statusConfig[data.health?.uptime_status ?? 'unknown'] ?? statusConfig.unknown);

	const gh = $derived(data.githubRepo);

	function githubDeploymentPageUrl(deployId: number): string | null {
		const r = gh;
		if (!r) return null;
		return `https://github.com/${encodeURIComponent(r.owner)}/${encodeURIComponent(r.repo)}/deployments/${deployId}`;
	}

	function githubActionsRunUrl(runId: number): string | null {
		const r = gh;
		if (!r) return null;
		return `https://github.com/${encodeURIComponent(r.owner)}/${encodeURIComponent(r.repo)}/actions/runs/${runId}`;
	}

	function deployStateTone(state: string): string {
		const s = String(state).toLowerCase();
		if (s === 'success') return 'text-green-400';
		if (s.includes('fail') || s === 'error' || s === 'failure') return 'text-red-400';
		if (s.includes('pend') || s.includes('progress') || s === 'queued' || s === 'in_progress') return 'text-amber-400';
		return 'text-zinc-400';
	}

	function ciStatusTone(status: string): string {
		const s = String(status).toLowerCase();
		if (s === 'success') return 'text-green-400';
		if (s === 'failure') return 'text-red-400';
		if (s === 'cancelled') return 'text-zinc-500';
		if (s === 'in_progress' || s === 'pending') return 'text-amber-400';
		return 'text-zinc-200';
	}

	const showGithubBlock = $derived(
		Boolean(gh) || (data.githubDeploymentLog?.length ?? 0) > 0 || (data.githubCiRuns?.length ?? 0) > 0
	);
</script>

<svelte:head>
	<title>Status — {data.projectName}</title>
	<meta name="robots" content="noindex,nofollow" />
</svelte:head>

<div class="min-h-screen bg-zinc-950 text-zinc-100">
	<div class="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
		<p class="text-center text-xs font-medium uppercase tracking-widest text-zinc-500">Public status</p>
		<h1 class="mt-2 text-center text-2xl font-bold text-white sm:text-3xl">{data.projectName}</h1>

		{#if data.health}
			{@const StatusIcon = cfg.icon}
			<div class="mt-10 rounded-2xl border-2 p-8 {cfg.bg}">
				<div class="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
					<StatusIcon size={56} class={cfg.color} />
					<div>
						<h2 class="text-3xl font-bold {cfg.color}">{cfg.label}</h2>
						<p class="mt-1 text-sm text-zinc-400">Last updated {timeAgo(data.updatedAt)}</p>
					</div>
				</div>
			</div>
		{:else}
			<div class="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-10 text-center">
				<HeartPulse size={40} class="mx-auto text-zinc-500" />
				<p class="mt-4 text-lg font-medium text-zinc-300">No aggregate health row yet</p>
				<p class="mt-1 text-sm text-zinc-500">Per-service checks below still update when targets are configured.</p>
			</div>
		{/if}

		{#if data.services?.length}
			<div class="mt-8">
				<h2 class="text-sm font-semibold uppercase tracking-wide text-zinc-400">Services</h2>
				<p class="mt-1 text-xs text-zinc-500">
					Uptime % is successful checks in the last 24 hours. Probed from MintMVP; interval depends on your
					<code class="rounded bg-zinc-800 px-1 font-mono">/api/cron/monitoring-check</code> schedule.
				</p>
				<div class="mt-3 space-y-2">
					{#each data.services as s}
						<div
							class="flex flex-col gap-1 rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
						>
							<div>
								<p class="font-medium text-white">{s.name}</p>
								<p class="text-xs text-zinc-500">
									Last check {s.lastChecked ? timeAgo(s.lastChecked) : 'never'}
									{#if s.lastOk !== null}
										· last result {s.lastOk ? 'OK' : 'failed'}
									{/if}
								</p>
							</div>
							<div class="text-right">
								<p class="text-xs text-zinc-500">24h uptime</p>
								<p class="text-lg font-semibold tabular-nums text-white">
									{s.uptime24h === null ? '—' : `${Math.round(s.uptime24h * 100)}%`}
								</p>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if showGithubBlock}
			<div class="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
				<div class="flex items-start justify-between gap-3">
					<div>
						<h2 class="text-sm font-semibold uppercase tracking-wide text-zinc-400">GitHub</h2>
						<p class="mt-1 text-xs text-zinc-500">
							Recent deployments (REST API or cached sync) and workflow runs. Open links on GitHub for full logs and
							history.
						</p>
						{#if gh}
							<p class="mt-2 font-mono text-xs text-zinc-400">
								{gh.owner}/{gh.repo}
							</p>
						{/if}
						<p class="mt-1 text-[11px] text-zinc-600">
							Source:
							{#if data.githubDeploymentLogSource === 'live'}
								<span class="text-zinc-400">GitHub API</span>
							{:else if data.githubDeploymentLogSource === 'cached'}
								<span class="text-zinc-400">Cached from last sync</span>
							{:else}
								<span class="text-zinc-500">—</span>
							{/if}
						</p>
					</div>
					<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800/80">
						<Github size={22} class="text-zinc-200" />
					</div>
				</div>

				{#if data.githubDeploymentLog?.length}
					<h3 class="mt-6 text-xs font-semibold uppercase tracking-wide text-zinc-500">Deployments</h3>
					<div class="mt-2 max-h-72 overflow-y-auto rounded-lg border border-zinc-800 text-xs">
						<table class="w-full text-left">
							<thead class="sticky top-0 bg-zinc-900/95">
								<tr>
									<th class="px-2 py-2 text-zinc-500">When</th>
									<th class="px-2 py-2 text-zinc-500">State</th>
									<th class="px-2 py-2 text-zinc-500">Env</th>
									<th class="hidden px-2 py-2 text-zinc-500 sm:table-cell">Ref</th>
									<th class="px-2 py-2 text-zinc-500">SHA</th>
									<th class="px-2 py-2 text-zinc-500">Links</th>
								</tr>
							</thead>
							<tbody>
								{#each data.githubDeploymentLog as row}
									<tr class="border-t border-zinc-800/80 align-top">
										<td class="whitespace-nowrap px-2 py-1.5 text-zinc-500">{timeAgo(row.created_at)}</td>
										<td class="px-2 py-1.5 font-medium {deployStateTone(row.state)}">{row.state}</td>
										<td class="px-2 py-1.5 text-zinc-200">{row.environment}</td>
										<td class="hidden max-w-[100px] truncate px-2 py-1.5 font-mono text-[11px] text-zinc-400 sm:table-cell"
											>{row.ref ?? '—'}</td
										>
										<td class="px-2 py-1.5 font-mono text-[11px] text-zinc-300">{(row.commit_sha ?? '').slice(0, 7)}</td>
										<td class="px-2 py-1.5">
											<div class="flex flex-wrap gap-x-2 gap-y-0.5">
												{#if githubDeploymentPageUrl(row.gh_deploy_id)}
													<a
														href={githubDeploymentPageUrl(row.gh_deploy_id)!}
														target="_blank"
														rel="noopener noreferrer"
														class="inline-flex items-center gap-0.5 text-sky-400 hover:underline"
														>Deploy <ExternalLink size={10} /></a
													>
												{/if}
												{#if row.log_url}
													<a
														href={row.log_url}
														target="_blank"
														rel="noopener noreferrer"
														class="inline-flex items-center gap-0.5 text-sky-400 hover:underline"
														>Logs <ExternalLink size={10} /></a
													>
												{/if}
												{#if row.environment_url}
													<a
														href={row.environment_url}
														target="_blank"
														rel="noopener noreferrer"
														class="inline-flex items-center gap-0.5 text-sky-400 hover:underline"
														>Env <ExternalLink size={10} /></a
													>
												{/if}
											</div>
										</td>
									</tr>
									<tr class="border-t border-zinc-800/50 bg-zinc-950/40">
										<td colspan="6" class="px-2 pb-2 pt-0 text-zinc-400">
											<p class="pt-1 text-[11px] leading-snug">{row.description?.trim() ? row.description : '—'}</p>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else if gh}
					<p class="mt-4 text-sm text-zinc-500">No deployments returned for this repository yet.</p>
				{/if}

				{#if data.githubCiRuns?.length}
					<h3 class="mt-6 text-xs font-semibold uppercase tracking-wide text-zinc-500">Actions runs</h3>
					<div class="mt-2 max-h-56 overflow-y-auto rounded-lg border border-zinc-800 text-xs">
						<table class="w-full text-left">
							<thead class="sticky top-0 bg-zinc-900/95">
								<tr>
									<th class="px-2 py-2 text-zinc-500">When</th>
									<th class="px-2 py-2 text-zinc-500">Workflow</th>
									<th class="px-2 py-2 text-zinc-500">Branch</th>
									<th class="px-2 py-2 text-zinc-500">Status</th>
									<th class="px-2 py-2 text-zinc-500">SHA</th>
									<th class="px-2 py-2 text-zinc-500">Logs</th>
								</tr>
							</thead>
							<tbody>
								{#each data.githubCiRuns as run}
									<tr class="border-t border-zinc-800/80">
										<td class="whitespace-nowrap px-2 py-1.5 text-zinc-500">{timeAgo(run.created_at)}</td>
										<td class="max-w-[140px] truncate px-2 py-1.5 text-zinc-200" title={run.workflow_name}
											>{run.workflow_name}</td
										>
										<td class="px-2 py-1.5 font-mono text-[11px] text-zinc-400">{run.branch || '—'}</td>
										<td class="px-2 py-1.5 font-medium {ciStatusTone(run.status)}">{run.status}</td>
										<td class="px-2 py-1.5 font-mono text-[11px] text-zinc-300">{(run.commit_sha ?? '').slice(0, 7)}</td>
										<td class="px-2 py-1.5">
											{#if githubActionsRunUrl(run.gh_run_id)}
												<a
													href={githubActionsRunUrl(run.gh_run_id)!}
													target="_blank"
													rel="noopener noreferrer"
													class="inline-flex items-center gap-0.5 text-sky-400 hover:underline"
													>View <ExternalLink size={10} /></a
												>
											{:else}
												<span class="text-zinc-600">—</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		{/if}

		{#if data.health}
			<div class="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
				<div class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-center">
					<p class="text-xs font-medium text-zinc-500">Uptime</p>
					<p class="mt-1 text-lg font-semibold capitalize text-white">{data.health.uptime_status}</p>
				</div>
				<div class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-center">
					<p class="text-xs font-medium text-zinc-500">Errors</p>
					<p
						class="mt-1 text-lg font-semibold {data.health.error_count > 0 ? 'text-red-400' : 'text-white'}"
					>
						{data.health.error_count}
					</p>
				</div>
				<div class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-center">
					<p class="text-xs font-medium text-zinc-500">Warnings</p>
					<p
						class="mt-1 text-lg font-semibold {data.health.warning_count > 0 ? 'text-amber-400' : 'text-white'}"
					>
						{data.health.warning_count}
					</p>
				</div>
				<div class="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-center">
					<p class="text-xs font-medium text-zinc-500">Open incidents</p>
					<p class="mt-1 text-lg font-semibold {data.openIncidents > 0 ? 'text-red-400' : 'text-white'}">
						{data.openIncidents}
					</p>
				</div>
			</div>
		{/if}

		<p class="mt-12 text-center text-xs text-zinc-600">MintMVP · read-only status page</p>
	</div>
</div>

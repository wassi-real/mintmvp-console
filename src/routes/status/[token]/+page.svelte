<script lang="ts">
	import { HeartPulse, AlertCircle, CheckCircle, XCircle } from 'lucide-svelte';

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

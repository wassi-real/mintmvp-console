<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import StatCard from '$lib/components/StatCard.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import {
		FileText,
		ListTodo,
		FlaskConical,
		Rocket,
		AlertTriangle,
		Activity,
		ExternalLink,
		GitCommitHorizontal,
		GitBranch,
		HeartPulse,
		Globe,
		CheckCircle,
		XCircle,
		AlertCircle
	} from 'lucide-svelte';

	let { data } = $props();

	function timeAgo(dateStr: string | null): string {
		if (!dateStr) return 'Never';
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	}

	const healthConfig: Record<string, { color: string; bg: string; icon: any; label: string }> = {
		up: { color: 'text-green-400', bg: 'bg-green-950/30 border-green-600/40', icon: CheckCircle, label: 'Operational' },
		down: { color: 'text-red-400', bg: 'bg-red-950/30 border-red-600/40', icon: XCircle, label: 'Down' },
		degraded: { color: 'text-amber-400', bg: 'bg-amber-950/30 border-amber-600/40', icon: AlertCircle, label: 'Degraded' },
		unknown: { color: 'text-muted-foreground', bg: 'bg-card border-border', icon: HeartPulse, label: 'Unknown' }
	};

	const hcfg = $derived(healthConfig[data.health?.uptime_status ?? 'unknown'] ?? healthConfig.unknown);

	const kindLabels: Record<string, string> = { development: 'Dev', staging: 'Staging', production: 'Prod' };
	const envStatusDot: Record<string, string> = { healthy: 'bg-green-500', broken: 'bg-red-500', unknown: 'bg-zinc-500' };
</script>

<div>
	<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
		<PageHeader title={data.project.name} />
		<StatusBadge status={data.project.status} />
	</div>

	{#if data.project.staging_url || data.project.production_url}
		<div class="mt-3 flex flex-wrap gap-4">
			{#if data.project.staging_url}
				<a href={data.project.staging_url} target="_blank" rel="noopener"
					class="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
					<ExternalLink size={14} /> Staging
				</a>
			{/if}
			{#if data.project.production_url}
				<a href={data.project.production_url} target="_blank" rel="noopener"
					class="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
					<ExternalLink size={14} /> Production
				</a>
			{/if}
		</div>
	{/if}

	<!-- Primary stats -->
	<div class="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
		<StatCard label="Specs" value={data.stats.specs} icon={FileText} />
		<StatCard label="Tasks in Progress" value={data.stats.tasksInProgress} icon={ListTodo} />
		<StatCard
			label="Tests Passing"
			value="{data.stats.testsPassing}/{data.stats.testsTotal}"
			icon={FlaskConical}
			variant={data.stats.testsFailing === 0 && data.stats.testsTotal > 0 ? 'success' : 'warning'}
		/>
		<StatCard
			label="Open Incidents"
			value={data.stats.openIncidents}
			icon={AlertTriangle}
			variant={data.stats.openIncidents > 0 ? 'destructive' : 'success'}
		/>
	</div>

	<!-- Health + Environments row -->
	<div class="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
		<!-- System Health card -->
		<div class="rounded-xl border-2 p-5 {hcfg.bg}">
			{#if data.health}
				{@const StatusIcon = hcfg.icon}
				<div class="flex items-center gap-3">
					<StatusIcon size={28} class={hcfg.color} />
					<div>
						<h3 class="text-lg font-bold {hcfg.color}">{hcfg.label}</h3>
						<p class="text-xs text-muted-foreground">Last checked {timeAgo(data.health.last_check_at)}</p>
					</div>
				</div>
				<div class="mt-4 grid grid-cols-2 gap-3">
					<div class="rounded-lg border border-border bg-card/50 px-3 py-2 text-center">
						<p class="text-[11px] font-medium text-muted-foreground">Errors</p>
						<p class="text-xl font-bold {data.health.error_count > 0 ? 'text-red-400' : 'text-foreground'}">{data.health.error_count}</p>
					</div>
					<div class="rounded-lg border border-border bg-card/50 px-3 py-2 text-center">
						<p class="text-[11px] font-medium text-muted-foreground">Warnings</p>
						<p class="text-xl font-bold {data.health.warning_count > 0 ? 'text-amber-400' : 'text-foreground'}">{data.health.warning_count}</p>
					</div>
				</div>
			{:else}
				<div class="flex items-center gap-3">
					<HeartPulse size={28} class="text-muted-foreground" />
					<div>
						<h3 class="text-lg font-bold text-muted-foreground">No Health Data</h3>
						<p class="text-xs text-muted-foreground">Visit Monitoring to set up</p>
					</div>
				</div>
			{/if}
		</div>

		<!-- Environments summary -->
		<div class="rounded-xl border border-border bg-card p-5 lg:col-span-2">
			<h3 class="mb-3 flex items-center gap-2 text-base font-semibold text-foreground">
				<Globe size={18} class="text-muted-foreground" /> Environments
			</h3>
			{#if data.environments.length === 0}
				<p class="text-sm text-muted-foreground">No environments configured yet.</p>
			{:else}
				<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
					{#each data.environments as env}
						<div class="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 px-4 py-3">
							<span class="h-2.5 w-2.5 shrink-0 rounded-full {envStatusDot[env.status] ?? 'bg-zinc-500'}"></span>
							<div class="min-w-0 flex-1">
								<p class="text-sm font-semibold text-foreground">{kindLabels[env.kind] ?? env.kind}</p>
								<p class="truncate text-xs text-muted-foreground">{env.current_version || 'No version'}</p>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Codebase + secondary stats -->
	<div class="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
		<StatCard label="Commits" value={data.stats.commits} icon={GitCommitHorizontal} />
		<StatCard label="Merged" value={data.stats.commitsMerged} icon={GitCommitHorizontal} variant={data.stats.commitsMerged > 0 ? 'success' : 'default'} />
		<StatCard label="Branches" value={data.stats.branches} icon={GitBranch} />
		<StatCard label="Stable" value={data.stats.branchesStable} icon={GitBranch} variant={data.stats.branchesStable > 0 ? 'success' : 'default'} />
	</div>

	<!-- Recent Deployments -->
	<div class="mt-8">
		<h3 class="mb-4 text-lg font-semibold text-foreground">Recent Deployments</h3>
		{#if data.recentDeploys.length === 0}
			<p class="text-sm text-muted-foreground">No deployments yet.</p>
		{:else}
			<div class="space-y-2">
				{#each data.recentDeploys as deploy}
					<div class="flex flex-col gap-2 rounded-xl border border-border bg-card/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
						<div class="flex flex-wrap items-center gap-3">
							<Rocket size={18} class="shrink-0 text-muted-foreground" />
							<span class="text-base font-semibold text-foreground">{deploy.version}</span>
							<StatusBadge status={deploy.environment} size="sm" />
							<StatusBadge status={deploy.status} size="sm" />
						</div>
						<span class="text-sm text-muted-foreground">{timeAgo(deploy.created_at)}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Recent Activity -->
	<div class="mt-8">
		<h3 class="mb-4 text-lg font-semibold text-foreground">Recent Activity</h3>
		{#if data.recentActivity.length === 0}
			<p class="text-sm text-muted-foreground">No activity yet.</p>
		{:else}
			<div class="space-y-2">
				{#each data.recentActivity as entry}
					<div class="flex flex-col gap-1 rounded-xl border border-border bg-card/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
						<div class="flex items-center gap-3 min-w-0">
							<Activity size={16} class="shrink-0 text-muted-foreground" />
							<span class="truncate text-sm text-foreground">{entry.action}</span>
							<span class="shrink-0 text-xs text-muted-foreground">by {entry.actor}</span>
						</div>
						<span class="shrink-0 text-xs text-muted-foreground">{timeAgo(entry.created_at)}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

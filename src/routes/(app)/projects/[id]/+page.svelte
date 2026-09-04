<script lang="ts">
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import {
		FileText,
		ListTodo,
		FlaskConical,
		AlertTriangle,
		Activity,
		ArrowRight,
		ExternalLink,
		GitCommitHorizontal,
		GitBranch,
		GitPullRequest,
		Play,
		HeartPulse,
		Globe,
		Github,
		CheckCircle,
		XCircle,
		AlertCircle,
		Landmark,
		Workflow
	} from 'lucide-svelte';

	let { data } = $props();

	function timeAgo(dateStr: string | null): string {
		if (!dateStr) return 'Never';
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'Just now';
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.floor(hours / 24)}d ago`;
	}

	function delay(i: number) {
		return `${Math.min(i, 8) * 40}ms`;
	}

	const healthConfig: Record<string, { color: string; ring: string; icon: any; label: string }> = {
		up: {
			color: 'text-green-400',
			ring: 'border-green-600/40 bg-green-950/25',
			icon: CheckCircle,
			label: 'Operational'
		},
		down: {
			color: 'text-red-400',
			ring: 'border-red-600/40 bg-red-950/25',
			icon: XCircle,
			label: 'Down'
		},
		degraded: {
			color: 'text-amber-400',
			ring: 'border-amber-600/40 bg-amber-950/25',
			icon: AlertCircle,
			label: 'Degraded'
		},
		unknown: {
			color: 'text-muted-foreground',
			ring: 'border-border bg-card',
			icon: HeartPulse,
			label: 'Unknown'
		}
	};

	const hcfg = $derived(healthConfig[data.health?.uptime_status ?? 'unknown'] ?? healthConfig.unknown);

	const kindLabels: Record<string, string> = {
		development: 'Development',
		staging: 'Staging',
		production: 'Production'
	};
	const envStatusDot: Record<string, string> = {
		healthy: 'bg-green-500',
		broken: 'bg-red-500',
		unknown: 'bg-zinc-500'
	};

	const stats = $derived(data.stats);
	const deliveryPct = $derived(
		stats.totalTasks > 0 ? Math.round((stats.tasksDeployed / stats.totalTasks) * 100) : 0
	);
	const testsOk = $derived(stats.testsFailing === 0 && stats.testsTotal > 0);

	const primary = $derived([
		{
			label: 'Tasks in progress',
			value: stats.tasksInProgress,
			sub: `${stats.totalTasks} total`,
			icon: ListTodo,
			tone: 'text-foreground',
			href: 'tasks'
		},
		{
			label: 'Tests passing',
			value: `${stats.testsPassing}/${stats.testsTotal}`,
			sub: stats.testsFailing > 0 ? `${stats.testsFailing} failing` : 'all green',
			icon: FlaskConical,
			tone: testsOk ? 'text-success' : 'text-warning',
			href: 'tests'
		},
		{
			label: 'Open incidents',
			value: stats.openIncidents,
			sub: `${stats.totalIncidents} all time`,
			icon: AlertTriangle,
			tone: stats.openIncidents > 0 ? 'text-destructive' : 'text-success',
			href: 'incidents'
		},
		{
			label: 'Specs',
			value: stats.specs,
			sub: 'documented',
			icon: FileText,
			tone: 'text-foreground',
			href: 'specs'
		}
	]);

	const shortcuts = [
		{ label: 'Pipeline', icon: Workflow, href: 'pipeline' },
		{ label: 'Milestones', icon: Landmark, href: 'milestone' },
		{ label: 'Monitoring', icon: HeartPulse, href: 'monitoring' },
		{ label: 'Activity', icon: Activity, href: 'activity' }
	];

	const base = $derived(`/projects/${data.project.id}`);
</script>

<svelte:head>
	<title>{data.project.name} Â· MintMVP Console</title>
</svelte:head>

<!-- Sticky header: negative margins cancel the layout's scroll-pane padding -->
<div
	class="sticky top-0 z-10 -mx-4 -mt-4 mb-6 border-b border-border/60 bg-background/85 px-4 pb-4 pt-4 backdrop-blur-xl sm:-mx-6 sm:-mt-6 sm:px-6 sm:pb-4 sm:pt-6 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-8"
>
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div class="min-w-0">
			<div class="flex flex-wrap items-center gap-3">
				<h1 class="truncate text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
					{data.project.name}
				</h1>
				<StatusBadge status={data.project.status} size="sm" />
			</div>
			<p class="mt-1 flex items-center gap-1.5 text-sm {hcfg.color}">
				{#key hcfg.label}
					<hcfg.icon size={14} />
				{/key}
				{hcfg.label}
				{#if data.health}
					<span class="text-muted-foreground">Â· checked {timeAgo(data.health.last_check_at)}</span>
				{/if}
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			{#if data.project.staging_url}
				<a
					href={data.project.staging_url}
					target="_blank"
					rel="noopener"
					class="press inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
				>
					<ExternalLink size={14} /> Staging
				</a>
			{/if}
			{#if data.project.production_url}
				<a
					href={data.project.production_url}
					target="_blank"
					rel="noopener"
					class="press inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
				>
					<ExternalLink size={14} /> Production
				</a>
			{/if}
			<a
				href="{base}/tasks"
				class="press inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
			>
				<ListTodo size={15} /> Tasks
			</a>
		</div>
	</div>
</div>

<!-- Primary metrics -->
<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
	{#each primary as m, i (m.label)}
		<a
			href="{base}/{m.href}"
			class="rise card-hover group rounded-xl border border-border bg-card p-4"
			style:--delay={delay(i)}
		>
			<div class="flex items-center justify-between gap-2">
				<p class="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
					{m.label}
				</p>
				<m.icon size={16} class="shrink-0 text-muted-foreground" />
			</div>
			<p class="mt-2 text-2xl font-bold tabular-nums sm:text-3xl {m.tone}">{m.value}</p>
			<p class="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
				{m.sub}
				<ArrowRight
					size={12}
					class="opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
				/>
			</p>
		</a>
	{/each}
</div>

<!-- Delivery progress -->
<div class="rise card-hover mt-4 rounded-xl border border-border bg-card p-5" style:--delay="160ms">
	<div class="flex items-baseline justify-between gap-3">
		<h2 class="text-sm font-semibold text-foreground">Delivery progress</h2>
		<span class="text-sm tabular-nums text-muted-foreground">
			{stats.tasksDeployed}/{stats.totalTasks} deployed Â· <span class="font-bold text-foreground"
				>{deliveryPct}%</span
			>
		</span>
	</div>
	<div class="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
		<div
			class="h-full rounded-full bg-success transition-[width] duration-700 ease-out motion-reduce:transition-none"
			style:width="{deliveryPct}%"
		></div>
	</div>
	<div class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
		<span><span class="font-semibold text-foreground">{stats.tasksInProgress}</span> in progress</span>
		<span><span class="font-semibold text-foreground">{stats.tasksInTesting}</span> in testing</span>
		<span><span class="font-semibold text-foreground">{stats.tasksDeployed}</span> deployed</span>
	</div>
</div>

<!-- Health + environments -->
<div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
	<div class="rise rounded-xl border p-5 {hcfg.ring}" style:--delay="200ms">
		<div class="flex items-center gap-3">
			<hcfg.icon size={26} class={hcfg.color} />
			<div class="min-w-0">
				<h3 class="text-base font-bold {hcfg.color}">{hcfg.label}</h3>
				<p class="text-xs text-muted-foreground">
					{data.health ? `Checked ${timeAgo(data.health.last_check_at)}` : 'Set up in Monitoring'}
				</p>
			</div>
		</div>
		{#if data.health}
			<div class="mt-4 grid grid-cols-2 gap-3">
				<div class="rounded-lg border border-border bg-card/60 px-3 py-2 text-center">
					<p class="text-[11px] font-medium text-muted-foreground">Errors</p>
					<p
						class="text-xl font-bold tabular-nums {data.health.error_count > 0
							? 'text-red-400'
							: 'text-foreground'}"
					>
						{data.health.error_count}
					</p>
				</div>
				<div class="rounded-lg border border-border bg-card/60 px-3 py-2 text-center">
					<p class="text-[11px] font-medium text-muted-foreground">Warnings</p>
					<p
						class="text-xl font-bold tabular-nums {data.health.warning_count > 0
							? 'text-amber-400'
							: 'text-foreground'}"
					>
						{data.health.warning_count}
					</p>
				</div>
			</div>
		{:else}
			<a
				href="{base}/monitoring"
				class="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:underline"
			>
				Configure monitoring <ArrowRight size={14} />
			</a>
		{/if}
	</div>

	<div class="rise rounded-xl border border-border bg-card p-5 lg:col-span-2" style:--delay="240ms">
		<div class="mb-3 flex items-center justify-between gap-2">
			<h3 class="flex items-center gap-2 text-sm font-semibold text-foreground">
				<Globe size={16} class="text-muted-foreground" /> Environments
			</h3>
			<a
				href="{base}/environments"
				class="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
			>
				Manage
			</a>
		</div>
		{#if data.environments.length === 0}
			<p class="text-sm text-muted-foreground">No environments configured yet.</p>
		{:else}
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
				{#each data.environments as env (env.id)}
					<div class="rounded-lg border border-border bg-secondary/30 px-4 py-3">
						<div class="flex items-center gap-2">
							<span
								class="h-2 w-2 shrink-0 rounded-full {envStatusDot[env.status] ?? 'bg-zinc-500'}"
							></span>
							<p class="truncate text-sm font-semibold text-foreground">
								{kindLabels[env.kind] ?? env.kind}
							</p>
						</div>
						<p class="mt-1 truncate font-mono text-xs text-muted-foreground">
							{env.current_version || 'No version'}
						</p>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- Repository -->
<div class="rise mt-4 rounded-xl border border-border bg-card p-5" style:--delay="280ms">
	<div class="mb-4 flex flex-wrap items-center justify-between gap-2">
		<h3 class="flex items-center gap-2 text-sm font-semibold text-foreground">
			<Github size={16} class="text-muted-foreground" /> Repository
		</h3>
		{#if data.ghIntegration}
			<span class="flex items-center gap-2 text-xs text-muted-foreground">
				<span class="font-mono font-semibold text-foreground">
					{data.ghIntegration.repo_owner}/{data.ghIntegration.repo_name}
				</span>
				Â· synced {timeAgo(data.ghIntegration.last_sync_at)}
			</span>
		{:else}
			<a
				href="{base}/settings/github"
				class="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
			>
				Connect GitHub
			</a>
		{/if}
	</div>

	<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
		{#each [{ label: data.ghIntegration ? 'Commits' : 'Commits', value: stats.commits, icon: GitCommitHorizontal, tone: 'text-foreground' }, { label: data.ghIntegration ? 'Merged PRs' : 'Merged', value: stats.commitsMerged, icon: GitPullRequest, tone: stats.commitsMerged > 0 ? 'text-success' : 'text-foreground' }, { label: 'Branches', value: stats.branches, icon: GitBranch, tone: 'text-foreground' }, { label: data.ghIntegration ? 'Active branches' : 'Stable', value: stats.branchesStable, icon: GitBranch, tone: stats.branchesStable > 0 ? 'text-success' : 'text-foreground' }] as s (s.label)}
			<div class="rounded-lg border border-border bg-secondary/30 px-4 py-3">
				<div class="flex items-center justify-between gap-2">
					<p class="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
						{s.label}
					</p>
					<s.icon size={14} class="shrink-0 text-muted-foreground" />
				</div>
				<p class="mt-1 text-xl font-bold tabular-nums {s.tone}">{s.value}</p>
			</div>
		{/each}
	</div>

	{#if data.ghIntegration}
		<div class="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
			{#each [{ label: 'Pull requests', value: stats.ghPRs, icon: GitPullRequest, tone: 'text-foreground' }, { label: 'Open PRs', value: stats.ghPRsOpen, icon: GitPullRequest, tone: stats.ghPRsOpen > 0 ? 'text-warning' : 'text-foreground' }, { label: 'CI runs', value: stats.ghCIRuns, icon: Play, tone: 'text-foreground' }, { label: 'CI passing', value: stats.ghCIPassing, icon: Play, tone: stats.ghCIPassing > 0 ? 'text-success' : 'text-foreground' }] as s (s.label)}
				<div class="rounded-lg border border-border bg-secondary/30 px-4 py-3">
					<div class="flex items-center justify-between gap-2">
						<p class="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
							{s.label}
						</p>
						<s.icon size={14} class="shrink-0 text-muted-foreground" />
					</div>
					<p class="mt-1 text-xl font-bold tabular-nums {s.tone}">{s.value}</p>
				</div>
			{/each}
		</div>
		<p class="mt-3 text-xs text-muted-foreground">
			Repository stats refresh from GitHub in the background about every five minutes.
		</p>
	{/if}
</div>

<!-- Activity + shortcuts -->
<div class="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
	<div class="rise rounded-xl border border-border bg-card p-5 lg:col-span-2" style:--delay="320ms">
		<div class="mb-3 flex items-center justify-between gap-2">
			<h3 class="text-sm font-semibold text-foreground">Recent activity</h3>
			<a
				href="{base}/activity"
				class="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
			>
				View all
			</a>
		</div>
		{#if data.recentActivity.length === 0}
			<p class="text-sm text-muted-foreground">No activity yet.</p>
		{:else}
			<div class="flex flex-col gap-1.5">
				{#each data.recentActivity as entry (entry.id)}
					<div
						class="flex flex-col gap-1 rounded-lg border border-border/70 bg-secondary/20 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
					>
						<div class="flex min-w-0 items-center gap-2.5">
							<Activity size={14} class="shrink-0 text-muted-foreground" />
							<span class="truncate text-sm text-foreground">{entry.action}</span>
						</div>
						<span class="shrink-0 text-xs text-muted-foreground">
							{entry.actor} Â· {timeAgo(entry.created_at)}
						</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div class="rise rounded-xl border border-border bg-card p-5" style:--delay="360ms">
		<h3 class="mb-3 text-sm font-semibold text-foreground">Jump to</h3>
		<div class="grid grid-cols-2 gap-2">
			{#each shortcuts as s (s.href)}
				<a
					href="{base}/{s.href}"
					class="press flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
				>
					<s.icon size={15} class="shrink-0" />
					<span class="truncate">{s.label}</span>
				</a>
			{/each}
		</div>
	</div>
</div>

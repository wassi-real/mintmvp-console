<script lang="ts">
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import StatCard from '$lib/components/StatCard.svelte';
	import {
		Play,
		Rocket,
		CheckCircle2,
		XCircle,
		Clock,
		GitBranch,
		Settings2,
		Github
	} from 'lucide-svelte';

	let { data } = $props();

	type Tab = 'runs' | 'deployments';
	let activeTab: Tab = $state('runs');

	const successRuns = $derived(data.ciRuns.filter((r) => r.status === 'success').length);
	const failedRuns = $derived(data.ciRuns.filter((r) => r.status === 'failure').length);
	const pendingRuns = $derived(data.ciRuns.filter((r) => r.status === 'pending' || r.status === 'in_progress').length);
	const latestRun = $derived(data.ciRuns[0] ?? null);

	const stagingDeploys = $derived(data.ghDeployments.filter((d) => d.environment === 'staging' || d.environment === 'development'));
	const prodDeploys = $derived(data.ghDeployments.filter((d) => d.environment === 'production'));
	const lastStagingDeploy = $derived(stagingDeploys[0] ?? null);
	const lastProdDeploy = $derived(prodDeploys[0] ?? null);

	function timeAgo(d: string | null) {
		if (!d) return '--';
		const diff = Date.now() - new Date(d).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'Just now';
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.floor(hours / 24)}d ago`;
	}

	function shortSha(sha: string) {
		return sha ? sha.slice(0, 7) : '--';
	}
</script>

{#if data.ciRuns.length === 0 && data.ghDeployments.length === 0 && !data.integration}
	<div class="mt-12 text-center">
		<Play size={48} class="mx-auto text-muted-foreground/40" />
		<p class="mt-4 text-lg font-semibold text-foreground">No CI/CD Data</p>
		<p class="mt-1 text-sm text-muted-foreground">
			Connect a GitHub repository to sync workflow runs and deployments.
		</p>
		<a
			href="/projects/{data.project.id}/settings/github"
			class="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
		>
			<Settings2 size={16} />
			Setup GitHub
		</a>
	</div>
{:else}
	<!-- Latest CI status banner -->
	{#if latestRun}
		{@const isSuccess = latestRun.status === 'success'}
		{@const isFail = latestRun.status === 'failure'}
		<div
			class="mt-4 rounded-xl border-2 p-5 {isSuccess
				? 'border-green-900/50 bg-green-950/10'
				: isFail
					? 'border-red-900/50 bg-red-950/10'
					: 'border-amber-900/50 bg-amber-950/10'}"
		>
			<div class="flex items-center gap-3">
				{#if isSuccess}
					<CheckCircle2 size={28} class="text-green-400" />
				{:else if isFail}
					<XCircle size={28} class="text-red-400" />
				{:else}
					<Clock size={28} class="text-amber-400" />
				{/if}
				<div>
					<h3 class="text-lg font-bold {isSuccess ? 'text-green-400' : isFail ? 'text-red-400' : 'text-amber-400'}">
						Latest CI Run: {latestRun.status.toUpperCase()}
					</h3>
					<p class="text-sm text-muted-foreground">
						{latestRun.workflow_name}
						{#if latestRun.branch}
							on <code class="rounded bg-secondary px-1 py-0.5 font-mono text-xs">{latestRun.branch}</code>
						{/if}
						&middot; {timeAgo(latestRun.created_at)}
					</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Stats -->
	<div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
		<StatCard label="Total Runs" value={data.ciRuns.length} icon={Play} />
		<StatCard label="Passed" value={successRuns} icon={CheckCircle2} variant="success" />
		<StatCard label="Failed" value={failedRuns} icon={XCircle} variant="destructive" />
		<StatCard label="Deployments" value={data.ghDeployments.length} icon={Rocket} />
	</div>

	<!-- Deploy summary -->
	{#if lastStagingDeploy || lastProdDeploy}
		<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
			{#if lastStagingDeploy}
				<div class="rounded-xl border border-border bg-card p-5">
					<div class="flex items-center gap-2">
						<Rocket size={16} class="text-sky-400" />
						<h4 class="text-sm font-semibold text-foreground">Staging</h4>
					</div>
					<div class="mt-2 space-y-1 text-sm text-muted-foreground">
						<p>Commit: <code class="rounded bg-secondary px-1 py-0.5 font-mono text-xs">{shortSha(lastStagingDeploy.commit_sha)}</code></p>
						<p>Status: <StatusBadge status={lastStagingDeploy.status} size="sm" /></p>
						<p>{timeAgo(lastStagingDeploy.created_at)}</p>
					</div>
				</div>
			{/if}
			{#if lastProdDeploy}
				<div class="rounded-xl border border-border bg-card p-5">
					<div class="flex items-center gap-2">
						<Rocket size={16} class="text-indigo-400" />
						<h4 class="text-sm font-semibold text-foreground">Production</h4>
					</div>
					<div class="mt-2 space-y-1 text-sm text-muted-foreground">
						<p>Commit: <code class="rounded bg-secondary px-1 py-0.5 font-mono text-xs">{shortSha(lastProdDeploy.commit_sha)}</code></p>
						<p>Status: <StatusBadge status={lastProdDeploy.status} size="sm" /></p>
						<p>{timeAgo(lastProdDeploy.created_at)}</p>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Tabs -->
	<div class="mt-6 flex gap-1 overflow-x-auto border-b border-border">
		{#each [
			{ id: 'runs', label: 'Workflow Runs', icon: Play, count: data.ciRuns.length },
			{ id: 'deployments', label: 'Deployments', icon: Rocket, count: data.ghDeployments.length }
		] as tab}
			{@const TabIcon = tab.icon}
			<button
				onclick={() => (activeTab = tab.id as Tab)}
				class="flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors {activeTab === tab.id
					? 'border-primary text-foreground'
					: 'border-transparent text-muted-foreground hover:text-foreground'}"
			>
				<TabIcon size={16} />
				{tab.label}
				<span class="ml-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">{tab.count}</span>
			</button>
		{/each}
	</div>

	<!-- ═══════════ CI RUNS ═══════════ -->
	{#if activeTab === 'runs'}
		{#if data.ciRuns.length === 0}
			<div class="mt-12 text-center">
				<Play size={48} class="mx-auto text-muted-foreground/40" />
				<p class="mt-4 text-lg font-semibold text-foreground">No workflow runs</p>
				<p class="mt-1 text-sm text-muted-foreground">Runs will appear after GitHub Actions are triggered.</p>
			</div>
		{:else}
			<!-- Mobile cards -->
			<div class="mt-6 space-y-3 sm:hidden">
				{#each data.ciRuns as run}
					<div class="rounded-xl border border-border bg-card p-4">
						<div class="flex items-start justify-between gap-2">
							<div class="min-w-0 flex-1">
								<p class="text-sm font-semibold text-foreground">{run.workflow_name || 'Workflow'}</p>
								<p class="mt-0.5 text-xs text-muted-foreground">
									{run.branch}
									{#if run.commit_sha}
										&middot; <code class="font-mono">{shortSha(run.commit_sha)}</code>
									{/if}
								</p>
							</div>
							<StatusBadge status={run.status} size="sm" />
						</div>
						<p class="mt-2 text-xs text-muted-foreground">{timeAgo(run.created_at)}</p>
					</div>
				{/each}
			</div>

			<!-- Desktop table -->
			<div class="mt-6 hidden overflow-x-auto rounded-xl border border-border sm:block">
				<table class="w-full text-left">
					<thead class="border-b border-border bg-secondary/50">
						<tr>
							<th class="px-4 py-3 text-xs font-semibold text-muted-foreground">Workflow</th>
							<th class="px-4 py-3 text-xs font-semibold text-muted-foreground">Branch</th>
							<th class="hidden px-4 py-3 text-xs font-semibold text-muted-foreground md:table-cell">Commit</th>
							<th class="px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
							<th class="px-4 py-3 text-xs font-semibold text-muted-foreground">Time</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each data.ciRuns as run}
							<tr class="transition-colors hover:bg-secondary/20">
								<td class="px-4 py-3 text-sm font-medium text-foreground">{run.workflow_name || 'Workflow'}</td>
								<td class="px-4 py-3">
									<code class="rounded bg-secondary px-1.5 py-0.5 text-xs font-mono text-foreground">{run.branch}</code>
								</td>
								<td class="hidden px-4 py-3 md:table-cell">
									<code class="rounded bg-secondary px-1.5 py-0.5 text-xs font-mono text-foreground">{shortSha(run.commit_sha)}</code>
								</td>
								<td class="px-4 py-3"><StatusBadge status={run.status} size="sm" /></td>
								<td class="px-4 py-3 text-sm text-muted-foreground">{timeAgo(run.created_at)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

	<!-- ═══════════ DEPLOYMENTS ═══════════ -->
	{:else if activeTab === 'deployments'}
		{#if data.ghDeployments.length === 0}
			<div class="mt-12 text-center">
				<Rocket size={48} class="mx-auto text-muted-foreground/40" />
				<p class="mt-4 text-lg font-semibold text-foreground">No deployments synced</p>
				<p class="mt-1 text-sm text-muted-foreground">Deployments will appear after GitHub deployment events are triggered.</p>
			</div>
		{:else}
			<!-- Mobile cards -->
			<div class="mt-6 space-y-3 sm:hidden">
				{#each data.ghDeployments as dep}
					<div class="rounded-xl border border-border bg-card p-4">
						<div class="flex items-start justify-between gap-2">
							<div class="min-w-0 flex-1">
								<p class="text-sm font-semibold text-foreground capitalize">{dep.environment}</p>
								<p class="mt-0.5 text-xs text-muted-foreground">
									<code class="font-mono">{shortSha(dep.commit_sha)}</code>
								</p>
							</div>
							<StatusBadge status={dep.status} size="sm" />
						</div>
						<p class="mt-2 text-xs text-muted-foreground">{timeAgo(dep.created_at)}</p>
					</div>
				{/each}
			</div>

			<!-- Desktop table -->
			<div class="mt-6 hidden overflow-x-auto rounded-xl border border-border sm:block">
				<table class="w-full text-left">
					<thead class="border-b border-border bg-secondary/50">
						<tr>
							<th class="px-4 py-3 text-xs font-semibold text-muted-foreground">Environment</th>
							<th class="px-4 py-3 text-xs font-semibold text-muted-foreground">Commit</th>
							<th class="px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
							<th class="px-4 py-3 text-xs font-semibold text-muted-foreground">Time</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each data.ghDeployments as dep}
							<tr class="transition-colors hover:bg-secondary/20">
								<td class="px-4 py-3 text-sm font-medium capitalize text-foreground">{dep.environment}</td>
								<td class="px-4 py-3">
									<code class="rounded bg-secondary px-1.5 py-0.5 text-xs font-mono text-foreground">{shortSha(dep.commit_sha)}</code>
								</td>
								<td class="px-4 py-3"><StatusBadge status={dep.status} size="sm" /></td>
								<td class="px-4 py-3 text-sm text-muted-foreground">{timeAgo(dep.created_at)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}
{/if}

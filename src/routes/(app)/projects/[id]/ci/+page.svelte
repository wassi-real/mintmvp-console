<script lang="ts">
	import PageTitleBar from '$lib/components/PageTitleBar.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import {
		Play,
		Rocket,
		CheckCircle2,
		XCircle,
		Clock,
		CircleSlash,
		ExternalLink,
		Settings2,
		GitBranch,
		Github
	} from 'lucide-svelte';

	let { data } = $props();

	type Tab = 'runs' | 'deployments';
	let activeTab: Tab = $state('runs');

	const successRuns = $derived(data.ciRuns.filter((r) => r.status === 'success').length);
	const failedRuns = $derived(data.ciRuns.filter((r) => r.status === 'failure').length);
	const pendingRuns = $derived(data.ciRuns.filter((r) => r.status === 'pending' || r.status === 'in_progress').length);
	const latestRun = $derived(data.ciRuns[0] ?? null);
	const successRate = $derived(
		data.ciRuns.length > 0 ? Math.round((successRuns / data.ciRuns.length) * 100) : 0
	);

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

	function delay(i: number) {
		return `${Math.min(i, 8) * 40}ms`;
	}

	/** Pass/fail tone shared by workflow runs and deployments. */
	type Tone = { label: string; icon: any; pill: string; text: string; banner: string };

	const tones: Record<string, Tone> = {
		success: {
			label: 'Success',
			icon: CheckCircle2,
			pill: 'border-success/30 bg-success/10 text-success',
			text: 'text-success',
			banner: 'border-success/25 bg-success/5'
		},
		failure: {
			label: 'Failure',
			icon: XCircle,
			pill: 'border-destructive/40 bg-destructive/10 text-destructive',
			text: 'text-destructive',
			banner: 'border-destructive/30 bg-destructive/5'
		},
		in_progress: {
			label: 'In progress',
			icon: Clock,
			pill: 'border-warning/30 bg-warning/10 text-warning',
			text: 'text-warning',
			banner: 'border-warning/25 bg-warning/5'
		},
		pending: {
			label: 'Pending',
			icon: Clock,
			pill: 'border-warning/30 bg-warning/10 text-warning',
			text: 'text-warning',
			banner: 'border-warning/25 bg-warning/5'
		},
		cancelled: {
			label: 'Cancelled',
			icon: CircleSlash,
			pill: 'border-border bg-secondary text-muted-foreground',
			text: 'text-muted-foreground',
			banner: 'border-border bg-card'
		},
		inactive: {
			label: 'Inactive',
			icon: CircleSlash,
			pill: 'border-border bg-secondary text-muted-foreground',
			text: 'text-muted-foreground',
			banner: 'border-border bg-card'
		}
	};

	function tone(status: string): Tone {
		return (
			tones[status] ?? {
				label: status.replace(/_/g, ' '),
				icon: Clock,
				pill: 'border-border bg-secondary text-muted-foreground',
				text: 'text-muted-foreground',
				banner: 'border-border bg-card'
			}
		);
	}

	const repoUrl = $derived(
		data.integration ? `https://github.com/${data.integration.repo_owner}/${data.integration.repo_name}` : null
	);

	function runUrl(ghRunId: number) {
		return repoUrl ? `${repoUrl}/actions/runs/${ghRunId}` : null;
	}

	function commitUrl(sha: string) {
		return repoUrl && sha ? `${repoUrl}/commit/${sha}` : null;
	}

	// Client-side narrowing of the run history only.
	let runFilter = $state('all');

	const runFilters = $derived([
		{ id: 'all', label: 'All', count: data.ciRuns.length },
		{ id: 'success', label: 'Passed', count: successRuns },
		{ id: 'failure', label: 'Failed', count: failedRuns },
		{ id: 'running', label: 'Running', count: pendingRuns }
	]);

	const visibleRuns = $derived(
		data.ciRuns.filter((r) => {
			if (runFilter === 'all') return true;
			if (runFilter === 'running') return r.status === 'pending' || r.status === 'in_progress';
			return r.status === runFilter;
		})
	);

	const stats = $derived([
		{ label: 'Total runs', value: data.ciRuns.length, icon: Play, tone: 'text-foreground' },
		{
			label: 'Passed',
			value: successRuns,
			icon: CheckCircle2,
			tone: successRuns > 0 ? 'text-success' : 'text-foreground'
		},
		{
			label: 'Failed',
			value: failedRuns,
			icon: XCircle,
			tone: failedRuns > 0 ? 'text-destructive' : 'text-foreground'
		},
		{ label: 'Deployments', value: data.ghDeployments.length, icon: Rocket, tone: 'text-foreground' }
	]);

	const envCards = $derived(
		[
			{ key: 'staging', label: 'Staging', deploy: lastStagingDeploy, total: stagingDeploys.length },
			{ key: 'production', label: 'Production', deploy: lastProdDeploy, total: prodDeploys.length }
		].filter((e) => e.deploy != null)
	);

	const hasNothing = $derived(
		data.ciRuns.length === 0 && data.ghDeployments.length === 0 && !data.integration
	);

	const tabs = $derived([
		{ id: 'runs', label: 'Workflow runs', icon: Play, count: data.ciRuns.length },
		{ id: 'deployments', label: 'Deployments', icon: Rocket, count: data.ghDeployments.length }
	]);
</script>

<PageTitleBar title="CI / CD" description="GitHub Actions runs and deployment history">
	{#snippet meta()}
		{#if data.integration}
			<span class="truncate font-mono text-foreground">
				{data.integration.repo_owner}/{data.integration.repo_name}
			</span>
			<span class="text-border">|</span>
		{/if}
		<span class="tabular-nums">{data.ciRuns.length} runs</span>
		<span class="text-border">|</span>
		<span class="tabular-nums">{data.ghDeployments.length} deployments</span>
		{#if pendingRuns > 0}
			<span class="text-border">|</span>
			<span class="inline-flex items-center gap-1.5 text-warning">
				<span class="live-dot"></span>
				<span class="tabular-nums">{pendingRuns}</span> running
			</span>
		{/if}
	{/snippet}
	{#snippet actions()}
		{#if repoUrl}
			<a
				href="{repoUrl}/actions"
				target="_blank"
				rel="noopener noreferrer"
				class="press inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
			>
				<ExternalLink size={14} /> Actions
			</a>
		{/if}
		<a
			href="/projects/{data.project.id}/settings/github"
			class="press inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
		>
			<Settings2 size={14} /> GitHub settings
		</a>
	{/snippet}
</PageTitleBar>

{#if hasNothing}
	<div class="rise rounded-xl border border-dashed border-border bg-card/40 pb-8">
		<EmptyState
			icon={Github}
			title="No CI/CD data"
			description="Connect a GitHub repository to sync workflow runs and deployments."
		/>
		<div class="flex justify-center">
			<a
				href="/projects/{data.project.id}/settings/github"
				class="press inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
			>
				<Settings2 size={15} /> Setup GitHub
			</a>
		</div>
	</div>
{:else}
	<!-- Latest run -->
	{#if latestRun}
		{@const t = tone(latestRun.status)}
		{@const latestRunHref = runUrl(latestRun.gh_run_id)}
		{@const latestCommitHref = commitUrl(latestRun.commit_sha)}
		<section class="rise rounded-xl border p-4 sm:p-5 {t.banner}" style:--delay="0ms">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div class="flex min-w-0 items-start gap-3">
					<t.icon size={22} class="mt-0.5 shrink-0 {t.text}" />
					<div class="min-w-0">
						<p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Latest run</p>
						<p class="mt-0.5 text-base font-bold {t.text}">{t.label}</p>
						<div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
							<span class="truncate text-foreground">{latestRun.workflow_name || 'Workflow'}</span>
							{#if latestRun.branch}
								<span class="inline-flex items-center gap-1 rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-foreground">
									<GitBranch size={11} />{latestRun.branch}
								</span>
							{/if}
							{#if latestCommitHref}
								<a href={latestCommitHref} target="_blank" rel="noopener noreferrer" class="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-primary hover:underline" title={latestRun.commit_sha}>
									{shortSha(latestRun.commit_sha)}
								</a>
							{:else if latestRun.commit_sha}
								<code class="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-foreground">{shortSha(latestRun.commit_sha)}</code>
							{/if}
							<span class="tabular-nums">{timeAgo(latestRun.created_at)}</span>
						</div>
					</div>
				</div>
				{#if latestRunHref}
					<a
						href={latestRunHref}
						target="_blank"
						rel="noopener noreferrer"
						class="press inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
					>
						<ExternalLink size={13} /> View run
					</a>
				{/if}
			</div>
		</section>
	{/if}

	<!-- Pipeline stats -->
	<section class="rise mt-4 rounded-xl border border-border bg-card p-4 sm:p-5" style:--delay="40ms">
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
			{#each stats as s (s.label)}
				<div class="rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
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

		{#if data.ciRuns.length > 0}
			<div class="mt-4">
				<div class="flex items-baseline justify-between gap-3">
					<p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Success rate</p>
					<p class="text-sm font-bold tabular-nums {failedRuns > 0 ? 'text-warning' : 'text-success'}">
						{successRate}%
					</p>
				</div>
				<div class="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
					<div
						class="h-full rounded-full bg-success transition-[width] duration-300 ease-out motion-reduce:transition-none"
						style:width="{successRate}%"
					></div>
				</div>
			</div>
		{/if}
	</section>

	<!-- Environment snapshots -->
	{#if envCards.length > 0}
		<div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
			{#each envCards as env, i (env.key)}
				{@const dep = env.deploy}
				{@const t = dep ? tone(dep.status) : null}
				{@const envCommitHref = dep ? commitUrl(dep.commit_sha) : null}
				<div class="rise card-hover rounded-xl border border-border bg-card p-4" style:--delay={delay(i + 2)}>
					<div class="flex items-center justify-between gap-2">
						<p class="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
							<Rocket size={13} />{env.label}
						</p>
						{#if dep && t}
							<span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium {t.pill}">
								<t.icon size={11} />{t.label}
							</span>
						{/if}
					</div>
					{#if dep}
						<div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
							{#if envCommitHref}
								<a href={envCommitHref} target="_blank" rel="noopener noreferrer" class="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-primary hover:underline" title={dep.commit_sha}>
									{shortSha(dep.commit_sha)}
								</a>
							{:else}
								<code class="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-foreground">{shortSha(dep.commit_sha)}</code>
							{/if}
							<span class="tabular-nums">{timeAgo(dep.created_at)}</span>
							<span class="tabular-nums">{env.total} total</span>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}

	<!-- Tabs -->
	<div class="mt-6 flex gap-1 overflow-x-auto border-b border-border">
		{#each tabs as tab (tab.id)}
			<button
				onclick={() => (activeTab = tab.id as Tab)}
				class="flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors {activeTab ===
				tab.id
					? 'border-primary text-foreground'
					: 'border-transparent text-muted-foreground hover:text-foreground'}"
			>
				<tab.icon size={15} />
				{tab.label}
				<span class="rounded-full bg-secondary px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
					{tab.count}
				</span>
			</button>
		{/each}
	</div>

	<!-- Workflow runs -->
	{#if activeTab === 'runs'}
		{#if data.ciRuns.length === 0}
			<div class="mt-4 rounded-xl border border-dashed border-border bg-card/40">
				<EmptyState
					icon={Play}
					title="No workflow runs"
					description="Runs appear here once GitHub Actions are triggered on the connected repository."
				/>
			</div>
		{:else}
			<div class="mt-4 flex flex-wrap items-center gap-1.5">
				{#each runFilters as f (f.id)}
					<button
						type="button"
						onclick={() => (runFilter = f.id)}
						class="press inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors {runFilter ===
						f.id
							? 'border-border bg-secondary text-foreground'
							: 'border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}"
					>
						{f.label}
						<span class="tabular-nums text-muted-foreground">{f.count}</span>
					</button>
				{/each}
			</div>

			{#if visibleRuns.length === 0}
				<p class="mt-4 rounded-xl border border-dashed border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
					No runs with this status.
				</p>
			{:else}
				<!-- Mobile cards -->
				<div class="mt-3 space-y-2 sm:hidden">
					{#each visibleRuns as run, i (run.id)}
						{@const t = tone(run.status)}
						<div class="rise card-hover rounded-xl border border-border bg-card p-4" style:--delay={delay(i)}>
							<div class="flex items-start justify-between gap-2">
								<div class="min-w-0 flex-1">
									<p class="truncate text-sm font-semibold text-foreground">{run.workflow_name || 'Workflow'}</p>
									<div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
										{#if run.branch}
											<span class="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-foreground">{run.branch}</span>
										{/if}
										{#if run.commit_sha}
											<code class="font-mono text-[11px]">{shortSha(run.commit_sha)}</code>
										{/if}
										<span class="tabular-nums">{timeAgo(run.created_at)}</span>
									</div>
								</div>
								<span class="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium {t.pill}">
									<t.icon size={11} />{t.label}
								</span>
							</div>
						</div>
					{/each}
				</div>

				<!-- Desktop table -->
				<div class="mt-3 hidden overflow-x-auto rounded-xl border border-border bg-card sm:block">
					<table class="w-full text-left">
						<thead>
							<tr class="border-b border-border/60">
								<th class="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Workflow</th>
								<th class="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Branch</th>
								<th class="hidden px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground md:table-cell">Commit</th>
								<th class="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
								<th class="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Time</th>
								<th class="px-4 py-2.5"><span class="sr-only">Open</span></th>
							</tr>
						</thead>
						<tbody class="divide-y divide-border/60">
							{#each visibleRuns as run, i (run.id)}
								{@const t = tone(run.status)}
								{@const url = runUrl(run.gh_run_id)}
								{@const commitHref = commitUrl(run.commit_sha)}
								<tr class="rise row-hover" style:--delay={delay(i)}>
									<td class="max-w-[220px] truncate px-4 py-2.5 text-sm font-medium text-foreground" title={run.workflow_name}>
										{run.workflow_name || 'Workflow'}
									</td>
									<td class="px-4 py-2.5">
										<code class="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-foreground">{run.branch || '--'}</code>
									</td>
									<td class="hidden px-4 py-2.5 md:table-cell">
										{#if commitHref}
											<a href={commitHref} target="_blank" rel="noopener noreferrer" class="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-primary hover:underline" title={run.commit_sha}>
												{shortSha(run.commit_sha)}
											</a>
										{:else}
											<code class="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-foreground">{shortSha(run.commit_sha)}</code>
										{/if}
									</td>
									<td class="px-4 py-2.5">
										<span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium {t.pill}">
											<t.icon size={11} />{t.label}
										</span>
									</td>
									<td class="whitespace-nowrap px-4 py-2.5 text-xs tabular-nums text-muted-foreground">{timeAgo(run.created_at)}</td>
									<td class="px-4 py-2.5 text-right">
										{#if url}
											<a
												href={url}
												target="_blank"
												rel="noopener noreferrer"
												class="inline-flex items-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
												aria-label="Open run on GitHub"
											>
												<ExternalLink size={14} />
											</a>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		{/if}

	<!-- Deployments -->
	{:else if activeTab === 'deployments'}
		{#if data.ghDeployments.length === 0}
			<div class="mt-4 rounded-xl border border-dashed border-border bg-card/40">
				<EmptyState
					icon={Rocket}
					title="No deployments synced"
					description="Deployments appear here once GitHub deployment events are triggered."
				/>
			</div>
		{:else}
			<!-- Mobile cards -->
			<div class="mt-4 space-y-2 sm:hidden">
				{#each data.ghDeployments as dep, i (dep.id)}
					{@const t = tone(dep.status)}
					<div class="rise card-hover rounded-xl border border-border bg-card p-4" style:--delay={delay(i)}>
						<div class="flex items-start justify-between gap-2">
							<div class="min-w-0 flex-1">
								<p class="truncate text-sm font-semibold capitalize text-foreground">{dep.environment}</p>
								<div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
									<code class="font-mono text-[11px]">{shortSha(dep.commit_sha)}</code>
									<span class="tabular-nums">{timeAgo(dep.created_at)}</span>
								</div>
							</div>
							<span class="inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium {t.pill}">
								<t.icon size={11} />{t.label}
							</span>
						</div>
					</div>
				{/each}
			</div>

			<!-- Desktop table -->
			<div class="mt-4 hidden overflow-x-auto rounded-xl border border-border bg-card sm:block">
				<table class="w-full text-left">
					<thead>
						<tr class="border-b border-border/60">
							<th class="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Environment</th>
							<th class="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Commit</th>
							<th class="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
							<th class="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Time</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border/60">
						{#each data.ghDeployments as dep, i (dep.id)}
							{@const t = tone(dep.status)}
							{@const commitHref = commitUrl(dep.commit_sha)}
							<tr class="rise row-hover" style:--delay={delay(i)}>
								<td class="px-4 py-2.5 text-sm font-medium capitalize text-foreground">{dep.environment}</td>
								<td class="px-4 py-2.5">
									{#if commitHref}
										<a href={commitHref} target="_blank" rel="noopener noreferrer" class="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-primary hover:underline" title={dep.commit_sha}>
											{shortSha(dep.commit_sha)}
										</a>
									{:else}
										<code class="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-foreground">{shortSha(dep.commit_sha)}</code>
									{/if}
								</td>
								<td class="px-4 py-2.5">
									<span class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium {t.pill}">
										<t.icon size={11} />{t.label}
									</span>
								</td>
								<td class="whitespace-nowrap px-4 py-2.5 text-xs tabular-nums text-muted-foreground">{timeAgo(dep.created_at)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}
{/if}

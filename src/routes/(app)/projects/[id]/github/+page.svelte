<script lang="ts">
	import PageTitleBar from '$lib/components/PageTitleBar.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import {
		Github,
		GitBranch,
		GitPullRequest,
		GitCommitHorizontal,
		ExternalLink,
		Settings2,
		AlertTriangle,
		CheckCircle2,
		RefreshCw,
		Search,
		Loader
	} from 'lucide-svelte';

	let { data, form } = $props();

	let syncSubmitting = $state(false);

	const syncCounts = $derived.by(() => {
		const f = form;
		if (f == null || typeof f !== 'object') return null;
		const sc = (f as Record<string, unknown>).syncCounts;
		if (sc == null || typeof sc !== 'object' || Array.isArray(sc)) return null;
		return sc as Record<string, number>;
	});
	const syncFormError = $derived.by(() => {
		const f = form;
		if (f == null || typeof f !== 'object') return '';
		const err = (f as Record<string, unknown>).error;
		return typeof err === 'string' ? err : '';
	});

	type Tab = 'branches' | 'pull_requests' | 'commits';
	let activeTab: Tab = $state('branches');

	const openPRs = $derived(data.pullRequests.filter((p) => p.status === 'open').length);
	const mergedPRs = $derived(data.pullRequests.filter((p) => p.status === 'merged').length);
	const activeBranches = $derived(data.branches.filter((b) => b.status === 'active').length);

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
		return sha.slice(0, 7);
	}

	function delay(i: number) {
		return `${Math.min(i, 8) * 40}ms`;
	}

	function branchTreeUrl(branchName: string) {
		if (!data.integration) return '#';
		const { repo_owner: o, repo_name: r } = data.integration;
		return `https://github.com/${o}/${r}/tree/${encodeURIComponent(branchName)}`;
	}

	function commitPageUrl(fullSha: string) {
		if (!data.integration) return '#';
		const { repo_owner: o, repo_name: r } = data.integration;
		return `https://github.com/${o}/${r}/commit/${fullSha}`;
	}

	const repoUrl = $derived(
		data.integration
			? `https://github.com/${data.integration.repo_owner}/${data.integration.repo_name}`
			: '#'
	);

	// Client-side narrowing of the synced lists only.
	let query = $state('');
	const q = $derived(query.trim().toLowerCase());

	const visibleBranches = $derived(
		q
			? data.branches.filter(
					(b) =>
						b.name.toLowerCase().includes(q) ||
						(b.last_commit_message ?? '').toLowerCase().includes(q)
				)
			: data.branches
	);

	const visiblePRs = $derived(
		q
			? data.pullRequests.filter(
					(p) =>
						p.title.toLowerCase().includes(q) ||
						p.branch.toLowerCase().includes(q) ||
						p.author.toLowerCase().includes(q) ||
						String(p.gh_number).includes(q)
				)
			: data.pullRequests
	);

	const visibleCommits = $derived(
		q
			? data.commits.filter(
					(c) =>
						c.message.toLowerCase().includes(q) ||
						c.author.toLowerCase().includes(q) ||
						c.sha.toLowerCase().includes(q)
				)
			: data.commits
	);

	const stats = $derived([
		{ label: 'Branches', value: data.branches.length, icon: GitBranch, tone: 'text-foreground' },
		{
			label: 'Active branches',
			value: activeBranches,
			icon: GitBranch,
			tone: activeBranches > 0 ? 'text-success' : 'text-foreground'
		},
		{
			label: 'Open PRs',
			value: openPRs,
			icon: GitPullRequest,
			tone: openPRs > 0 ? 'text-warning' : 'text-foreground'
		},
		{
			label: 'Merged PRs',
			value: mergedPRs,
			icon: GitPullRequest,
			tone: mergedPRs > 0 ? 'text-success' : 'text-foreground'
		}
	]);

	const tabs = $derived([
		{ id: 'branches', label: 'Branches', icon: GitBranch, count: data.branches.length },
		{ id: 'pull_requests', label: 'Pull requests', icon: GitPullRequest, count: data.pullRequests.length },
		{ id: 'commits', label: 'Commits', icon: GitCommitHorizontal, count: data.commits.length }
	]);

	const searchPlaceholder = $derived(
		activeTab === 'branches'
			? 'Search branches...'
			: activeTab === 'pull_requests'
				? 'Search pull requests...'
				: 'Search commits...'
	);
</script>

<PageTitleBar title="GitHub" description="Branches, pull requests, and commits synced from the repository">
	{#snippet meta()}
		{#if data.integration}
			<span class="truncate font-mono text-foreground">
				{data.integration.repo_owner}/{data.integration.repo_name}
			</span>
			<span class="text-border">|</span>
			<span class="inline-flex items-center gap-1.5">
				<span class="live-dot"></span>
				synced {timeAgo(data.integration.last_sync_at)}
			</span>
			<span class="text-border">|</span>
			<span class="tabular-nums">{data.commits.length} commits</span>
		{:else}
			<span>No repository connected</span>
		{/if}
	{/snippet}
	{#snippet actions()}
		{#if data.integration}
			<a
				href={repoUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="press inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
			>
				<ExternalLink size={14} /> Repository
			</a>
			{#if data.canSyncGithub}
				<form
					method="POST"
					action="?/sync"
					use:enhance={() => {
						syncSubmitting = true;
						return async ({ update }) => {
							await update();
							syncSubmitting = false;
							await invalidateAll();
						};
					}}
				>
					<button
						type="submit"
						disabled={syncSubmitting}
						class="press inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
					>
						{#if syncSubmitting}
							<Loader size={15} class="animate-spin" />
							Syncing...
						{:else}
							<RefreshCw size={15} />
							Sync now
						{/if}
					</button>
				</form>
			{/if}
		{:else}
			<a
				href="/projects/{data.project.id}/settings/github"
				class="press inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
			>
				<Settings2 size={15} /> Setup GitHub
			</a>
		{/if}
	{/snippet}
</PageTitleBar>

{#if !data.integration}
	<div class="rise rounded-xl border border-dashed border-border bg-card/40">
		<EmptyState
			icon={Github}
			title="No GitHub integration"
			description="Connect a GitHub repository to see branches, pull requests, and commits here."
		/>
	</div>
{:else}
	{#if syncFormError}
		<div class="mb-3 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-foreground">
			<AlertTriangle size={16} class="mt-0.5 shrink-0 text-destructive" />
			<span class="min-w-0 break-words">{syncFormError}</span>
		</div>
	{/if}

	{#if syncCounts}
		<div class="mb-3 flex items-start gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm">
			<CheckCircle2 size={16} class="mt-0.5 shrink-0 text-success" />
			<div class="min-w-0">
				<p class="font-medium text-success">Sync complete</p>
				<p class="mt-0.5 text-xs tabular-nums text-muted-foreground">
					{syncCounts.branches} branches &middot; {syncCounts.prs} PRs &middot; {syncCounts.commits} commits &middot; {syncCounts.ciRuns} CI runs
				</p>
			</div>
		</div>
	{/if}

	<!-- Repository summary -->
	<section class="rise rounded-xl border border-border bg-card p-4 sm:p-5" style:--delay="0ms">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<a
				href={repoUrl}
				target="_blank"
				rel="noopener noreferrer"
				class="inline-flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground hover:underline"
			>
				<Github size={16} class="shrink-0 text-muted-foreground" />
				<span class="truncate font-mono">{data.integration.repo_owner}/{data.integration.repo_name}</span>
				<ExternalLink size={12} class="shrink-0 text-muted-foreground" />
			</a>
			<span class="text-xs text-muted-foreground">
				Auto-syncs about every five minutes &middot; last sync {timeAgo(data.integration.last_sync_at)}
			</span>
		</div>

		<div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
	</section>

	<!-- Tabs + search -->
	<div class="mt-6 flex flex-col gap-2 border-b border-border sm:flex-row sm:items-end sm:justify-between">
		<div class="flex gap-1 overflow-x-auto">
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
		<div class="relative pb-2 sm:w-64">
			<Search
				size={14}
				class="pointer-events-none absolute left-3 top-1/2 -mt-1 -translate-y-1/2 text-muted-foreground"
			/>
			<input
				type="search"
				bind:value={query}
				aria-label={searchPlaceholder}
				placeholder={searchPlaceholder}
				class="w-full rounded-lg border border-input bg-card py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground"
			/>
		</div>
	</div>

	<!-- Branches -->
	{#if activeTab === 'branches'}
		{#if data.branches.length === 0}
			<div class="mt-4 rounded-xl border border-dashed border-border bg-card/40">
				<EmptyState
					icon={GitBranch}
					title="No branches synced yet"
					description="Data loads from GitHub automatically about every five minutes. Check back shortly, or confirm the repo under Settings → GitHub."
				/>
			</div>
		{:else if visibleBranches.length === 0}
			<p class="mt-4 rounded-xl border border-dashed border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
				No branches match "{query}".
			</p>
		{:else}
			<!-- Mobile cards -->
			<div class="mt-4 space-y-2 sm:hidden">
				{#each visibleBranches as b, i (b.id)}
					<div class="rise card-hover rounded-xl border border-border bg-card p-4" style:--delay={delay(i)}>
						<div class="flex items-start justify-between gap-2">
							<a
								href={branchTreeUrl(b.name)}
								target="_blank"
								rel="noopener noreferrer"
								class="min-w-0 flex-1 break-all font-mono text-sm font-semibold text-primary hover:underline"
							>{b.name}</a>
							<StatusBadge status={b.status} size="sm" />
						</div>
						{#if b.last_commit_message}
							<p class="mt-1.5 line-clamp-2 break-words text-xs text-muted-foreground">{b.last_commit_message}</p>
						{/if}
						<div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
							{#if b.last_commit_sha}
								<a
									href={commitPageUrl(b.last_commit_sha)}
									target="_blank"
									rel="noopener noreferrer"
									class="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-primary hover:underline"
									title={b.last_commit_sha}
								>{shortSha(b.last_commit_sha)}</a>
							{/if}
							<span class="tabular-nums">{timeAgo(b.updated_at)}</span>
						</div>
					</div>
				{/each}
			</div>

			<!-- Desktop table -->
			<div class="mt-4 hidden overflow-x-auto rounded-xl border border-border bg-card sm:block">
				<table class="w-full text-left">
					<thead>
						<tr class="border-b border-border/60">
							<th class="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Branch</th>
							<th class="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Last commit</th>
							<th class="hidden px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground md:table-cell">SHA</th>
							<th class="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Updated</th>
							<th class="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border/60">
						{#each visibleBranches as b, i (b.id)}
							<tr class="rise row-hover" style:--delay={delay(i)}>
								<td class="max-w-[220px] truncate px-4 py-2.5">
									<a
										href={branchTreeUrl(b.name)}
										target="_blank"
										rel="noopener noreferrer"
										class="font-mono text-sm font-medium text-primary hover:underline"
										title={b.name}
									>{b.name}</a>
								</td>
								<td class="max-w-[320px] truncate px-4 py-2.5 text-xs text-muted-foreground" title={b.last_commit_message ?? ''}>
									{b.last_commit_message || '--'}
								</td>
								<td class="hidden px-4 py-2.5 md:table-cell">
									{#if b.last_commit_sha}
										<a
											href={commitPageUrl(b.last_commit_sha)}
											target="_blank"
											rel="noopener noreferrer"
											class="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-primary hover:underline"
											title={b.last_commit_sha}
										>{shortSha(b.last_commit_sha)}</a>
									{:else}
										<span class="text-xs text-muted-foreground">--</span>
									{/if}
								</td>
								<td class="whitespace-nowrap px-4 py-2.5 text-xs tabular-nums text-muted-foreground">{timeAgo(b.updated_at)}</td>
								<td class="px-4 py-2.5"><StatusBadge status={b.status} size="sm" /></td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

	<!-- Pull requests -->
	{:else if activeTab === 'pull_requests'}
		{#if data.pullRequests.length === 0}
			<div class="mt-4 rounded-xl border border-dashed border-border bg-card/40">
				<EmptyState
					icon={GitPullRequest}
					title="No pull requests synced"
					description="Pull requests sync with the same automatic GitHub refresh. Check back in a few minutes if you just connected the repo."
				/>
			</div>
		{:else if visiblePRs.length === 0}
			<p class="mt-4 rounded-xl border border-dashed border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
				No pull requests match "{query}".
			</p>
		{:else}
			<!-- Mobile cards -->
			<div class="mt-4 space-y-2 sm:hidden">
				{#each visiblePRs as pr, i (pr.id)}
					<div class="rise card-hover rounded-xl border border-border bg-card p-4" style:--delay={delay(i)}>
						<div class="flex items-start justify-between gap-2">
							<p class="min-w-0 flex-1 break-words text-sm font-semibold text-foreground">
								<span class="tabular-nums text-muted-foreground">#{pr.gh_number}</span>
								{pr.title}
							</p>
							<StatusBadge status={pr.status} size="sm" />
						</div>
						<div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
							<span class="truncate">{pr.author}</span>
							<code class="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-foreground">{pr.branch}</code>
							<span class="tabular-nums">Created {timeAgo(pr.created_at)}</span>
							{#if pr.merged_at}
								<span class="tabular-nums text-success">Merged {timeAgo(pr.merged_at)}</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>

			<!-- Desktop table -->
			<div class="mt-4 hidden overflow-x-auto rounded-xl border border-border bg-card sm:block">
				<table class="w-full text-left">
					<thead>
						<tr class="border-b border-border/60">
							<th class="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">#</th>
							<th class="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Title</th>
							<th class="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Branch</th>
							<th class="hidden px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground md:table-cell">Author</th>
							<th class="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
							<th class="hidden px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:table-cell">Merged</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border/60">
						{#each visiblePRs as pr, i (pr.id)}
							<tr class="rise row-hover" style:--delay={delay(i)}>
								<td class="px-4 py-2.5 text-xs tabular-nums text-muted-foreground">#{pr.gh_number}</td>
								<td class="max-w-[320px] truncate px-4 py-2.5 text-sm font-medium text-foreground" title={pr.title}>{pr.title}</td>
								<td class="px-4 py-2.5">
									<code class="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-foreground">{pr.branch}</code>
								</td>
								<td class="hidden max-w-[160px] truncate px-4 py-2.5 text-xs text-muted-foreground md:table-cell">{pr.author}</td>
								<td class="px-4 py-2.5"><StatusBadge status={pr.status} size="sm" /></td>
								<td class="hidden whitespace-nowrap px-4 py-2.5 text-xs tabular-nums text-muted-foreground lg:table-cell">
									{pr.merged_at ? timeAgo(pr.merged_at) : '--'}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

	<!-- Commits -->
	{:else if activeTab === 'commits'}
		{#if data.commits.length === 0}
			<div class="mt-4 rounded-xl border border-dashed border-border bg-card/40">
				<EmptyState
					icon={GitCommitHorizontal}
					title="No commits synced"
					description="Commits on the default branch sync automatically. Large histories may take an extra cycle to fill in."
				/>
			</div>
		{:else if visibleCommits.length === 0}
			<p class="mt-4 rounded-xl border border-dashed border-border bg-card/40 px-4 py-8 text-center text-sm text-muted-foreground">
				No commits match "{query}".
			</p>
		{:else}
			<!-- Mobile cards -->
			<div class="mt-4 space-y-2 sm:hidden">
				{#each visibleCommits as c, i (c.id)}
					<div class="rise card-hover rounded-xl border border-border bg-card p-4" style:--delay={delay(i)}>
						<p class="line-clamp-2 break-words text-sm font-medium text-foreground">{c.message}</p>
						<div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
							<a
								href={commitPageUrl(c.sha)}
								target="_blank"
								rel="noopener noreferrer"
								class="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-primary hover:underline"
								title={c.sha}
							>{shortSha(c.sha)}</a>
							<span class="truncate">{c.author}</span>
							<span class="tabular-nums">{timeAgo(c.committed_at)}</span>
						</div>
					</div>
				{/each}
			</div>

			<!-- Desktop table -->
			<div class="mt-4 hidden overflow-x-auto rounded-xl border border-border bg-card sm:block">
				<table class="w-full text-left">
					<thead>
						<tr class="border-b border-border/60">
							<th class="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">SHA</th>
							<th class="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Message</th>
							<th class="hidden px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground md:table-cell">Author</th>
							<th class="hidden px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground md:table-cell">Branch</th>
							<th class="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Time</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border/60">
						{#each visibleCommits as c, i (c.id)}
							<tr class="rise row-hover" style:--delay={delay(i)}>
								<td class="px-4 py-2.5">
									<a
										href={commitPageUrl(c.sha)}
										target="_blank"
										rel="noopener noreferrer"
										class="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-primary hover:underline"
										title={c.sha}
									>{shortSha(c.sha)}</a>
								</td>
								<td class="max-w-[420px] truncate px-4 py-2.5 text-sm text-foreground" title={c.message}>{c.message}</td>
								<td class="hidden max-w-[160px] truncate px-4 py-2.5 text-xs text-muted-foreground md:table-cell">{c.author}</td>
								<td class="hidden px-4 py-2.5 md:table-cell">
									{#if c.branch}
										<code class="rounded bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-foreground">{c.branch}</code>
									{:else}
										<span class="text-xs text-muted-foreground">--</span>
									{/if}
								</td>
								<td class="whitespace-nowrap px-4 py-2.5 text-xs tabular-nums text-muted-foreground">{timeAgo(c.committed_at)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}
{/if}

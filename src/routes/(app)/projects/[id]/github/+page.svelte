<script lang="ts">
	import StatusBadge from '$lib/components/StatusBadge.svelte';
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
		RefreshCw,
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
</script>

{#if !data.integration}
	<div class="mt-12 text-center">
		<Github size={48} class="mx-auto text-muted-foreground/40" />
		<p class="mt-4 text-lg font-semibold text-foreground">No GitHub Integration</p>
		<p class="mt-1 text-sm text-muted-foreground">
			Connect a GitHub repository to see branches, pull requests, and commits.
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
	<!-- Connection status -->
	<div class="mt-4 flex flex-wrap items-center gap-4 rounded-xl border border-border bg-card p-4">
		<div class="flex items-center gap-2">
			<Github size={18} class="text-foreground" />
			<span class="text-sm font-semibold text-foreground">
				{data.integration.repo_owner}/{data.integration.repo_name}
			</span>
		</div>
		<div class="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
			<span>Last sync: {timeAgo(data.integration.last_sync_at)}</span>
			<a
				href="https://github.com/{data.integration.repo_owner}/{data.integration.repo_name}"
				target="_blank"
				class="flex items-center gap-1 text-primary hover:underline"
			>
				<ExternalLink size={12} />
				Open on GitHub
			</a>
			{#if data.canSyncGithub}
				<form
					method="POST"
					action="?/sync"
					class="inline"
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
						class="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-secondary/80 disabled:opacity-50"
					>
						{#if syncSubmitting}
							<Loader size={14} class="animate-spin" />
							Syncing…
						{:else}
							<RefreshCw size={14} />
							Sync now
						{/if}
					</button>
				</form>
			{/if}
		</div>
	</div>

	{#if syncFormError}
		<div class="mt-3 rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-300">{syncFormError}</div>
	{/if}

	{#if syncCounts}
		<div class="mt-3 rounded-lg border border-green-900/40 bg-green-950/20 px-4 py-3 text-sm">
			<p class="font-semibold text-green-400">Sync complete</p>
			<p class="mt-1 text-xs text-muted-foreground">
				{syncCounts.branches} branches · {syncCounts.prs} PRs · {syncCounts.commits} commits · {syncCounts.ciRuns} CI runs
			</p>
		</div>
	{/if}

	<!-- Stats row -->
	<div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
		<div class="rounded-xl border border-border bg-card p-4 text-center">
			<p class="text-2xl font-bold text-foreground">{data.branches.length}</p>
			<p class="text-xs text-muted-foreground">Branches</p>
		</div>
		<div class="rounded-xl border border-border bg-card p-4 text-center">
			<p class="text-2xl font-bold text-foreground">{openPRs}</p>
			<p class="text-xs text-muted-foreground">Open PRs</p>
		</div>
		<div class="rounded-xl border border-border bg-card p-4 text-center">
			<p class="text-2xl font-bold text-green-400">{mergedPRs}</p>
			<p class="text-xs text-muted-foreground">Merged PRs</p>
		</div>
		<div class="rounded-xl border border-border bg-card p-4 text-center">
			<p class="text-2xl font-bold text-foreground">{data.commits.length}</p>
			<p class="text-xs text-muted-foreground">Commits</p>
		</div>
	</div>

	<!-- Tabs -->
	<div class="mt-6 flex gap-1 overflow-x-auto border-b border-border">
		{#each [
			{ id: 'branches', label: 'Branches', icon: GitBranch, count: data.branches.length },
			{ id: 'pull_requests', label: 'Pull Requests', icon: GitPullRequest, count: data.pullRequests.length },
			{ id: 'commits', label: 'Commits', icon: GitCommitHorizontal, count: data.commits.length }
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

	<!-- ═══════════ BRANCHES ═══════════ -->
	{#if activeTab === 'branches'}
		{#if data.branches.length === 0}
			<div class="mt-12 text-center">
				<GitBranch size={48} class="mx-auto text-muted-foreground/40" />
				<p class="mt-4 text-lg font-semibold text-foreground">No branches synced yet</p>
				<p class="mt-1 text-sm text-muted-foreground">
					Data loads from GitHub automatically about every five minutes. Open this project again shortly, or check Settings → GitHub if the repo is connected.
				</p>
			</div>
		{:else}
			<!-- Mobile cards -->
			<div class="mt-6 space-y-3 sm:hidden">
				{#each data.branches as b}
					<div class="rounded-xl border border-border bg-card p-4">
						<div class="flex items-start justify-between gap-2">
							<div class="min-w-0 flex-1">
								<a
									href={branchTreeUrl(b.name)}
									target="_blank"
									rel="noopener noreferrer"
									class="text-sm font-semibold text-primary hover:underline font-mono"
								>{b.name}</a>
								{#if b.last_commit_message}
									<p class="mt-1 text-xs text-muted-foreground line-clamp-2">{b.last_commit_message}</p>
								{/if}
							</div>
							<StatusBadge status={b.status} size="sm" />
						</div>
						<div class="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
							{#if b.last_commit_sha}
								<a
									href={commitPageUrl(b.last_commit_sha)}
									target="_blank"
									rel="noopener noreferrer"
									class="rounded bg-secondary px-1.5 py-0.5 font-mono text-primary hover:underline"
									title={b.last_commit_sha}
								>{shortSha(b.last_commit_sha)}</a>
							{/if}
							<span>{timeAgo(b.updated_at)}</span>
						</div>
					</div>
				{/each}
			</div>

			<!-- Desktop table -->
			<div class="mt-6 hidden overflow-x-auto rounded-xl border border-border sm:block">
				<table class="w-full text-left">
					<thead class="border-b border-border bg-secondary/50">
						<tr>
							<th class="px-4 py-3 text-xs font-semibold text-muted-foreground">Branch</th>
							<th class="px-4 py-3 text-xs font-semibold text-muted-foreground">Last Commit</th>
							<th class="hidden px-4 py-3 text-xs font-semibold text-muted-foreground md:table-cell">SHA</th>
							<th class="px-4 py-3 text-xs font-semibold text-muted-foreground">Updated</th>
							<th class="px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each data.branches as b}
							<tr class="transition-colors hover:bg-secondary/20">
								<td class="px-4 py-3 font-mono text-sm font-medium">
									<a
										href={branchTreeUrl(b.name)}
										target="_blank"
										rel="noopener noreferrer"
										class="text-primary hover:underline"
									>{b.name}</a>
								</td>
								<td class="max-w-[300px] truncate px-4 py-3 text-sm text-muted-foreground">{b.last_commit_message || '--'}</td>
								<td class="hidden px-4 py-3 md:table-cell">
									{#if b.last_commit_sha}
										<a
											href={commitPageUrl(b.last_commit_sha)}
											target="_blank"
											rel="noopener noreferrer"
											class="rounded bg-secondary px-1.5 py-0.5 text-xs font-mono text-primary hover:underline"
											title={b.last_commit_sha}
										>{shortSha(b.last_commit_sha)}</a>
									{:else}
										<span class="text-sm text-muted-foreground">--</span>
									{/if}
								</td>
								<td class="px-4 py-3 text-sm text-muted-foreground">{timeAgo(b.updated_at)}</td>
								<td class="px-4 py-3"><StatusBadge status={b.status} size="sm" /></td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

	<!-- ═══════════ PULL REQUESTS ═══════════ -->
	{:else if activeTab === 'pull_requests'}
		{#if data.pullRequests.length === 0}
			<div class="mt-12 text-center">
				<GitPullRequest size={48} class="mx-auto text-muted-foreground/40" />
				<p class="mt-4 text-lg font-semibold text-foreground">No pull requests synced</p>
				<p class="mt-1 text-sm text-muted-foreground">
					Pull requests sync with the same automatic GitHub refresh. Check back in a few minutes if you just connected the repo.
				</p>
			</div>
		{:else}
			<!-- Mobile cards -->
			<div class="mt-6 space-y-3 sm:hidden">
				{#each data.pullRequests as pr}
					<div class="rounded-xl border border-border bg-card p-4">
						<div class="flex items-start justify-between gap-2">
							<div class="min-w-0 flex-1">
								<p class="text-sm font-semibold text-foreground">
									<span class="text-muted-foreground">#{pr.gh_number}</span> {pr.title}
								</p>
								<p class="mt-1 text-xs text-muted-foreground">
									{pr.author} &middot; {pr.branch}
								</p>
							</div>
							<StatusBadge status={pr.status} size="sm" />
						</div>
						<div class="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
							<span>Created {timeAgo(pr.created_at)}</span>
							{#if pr.merged_at}
								<span class="text-green-400">Merged {timeAgo(pr.merged_at)}</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>

			<!-- Desktop table -->
			<div class="mt-6 hidden overflow-x-auto rounded-xl border border-border sm:block">
				<table class="w-full text-left">
					<thead class="border-b border-border bg-secondary/50">
						<tr>
							<th class="px-4 py-3 text-xs font-semibold text-muted-foreground">#</th>
							<th class="px-4 py-3 text-xs font-semibold text-muted-foreground">Title</th>
							<th class="px-4 py-3 text-xs font-semibold text-muted-foreground">Branch</th>
							<th class="hidden px-4 py-3 text-xs font-semibold text-muted-foreground md:table-cell">Author</th>
							<th class="px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
							<th class="hidden px-4 py-3 text-xs font-semibold text-muted-foreground lg:table-cell">Merged</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each data.pullRequests as pr}
							<tr class="transition-colors hover:bg-secondary/20">
								<td class="px-4 py-3 text-sm text-muted-foreground">#{pr.gh_number}</td>
								<td class="max-w-[300px] truncate px-4 py-3 text-sm font-medium text-foreground">{pr.title}</td>
								<td class="px-4 py-3">
									<code class="rounded bg-secondary px-1.5 py-0.5 text-xs font-mono text-foreground">{pr.branch}</code>
								</td>
								<td class="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">{pr.author}</td>
								<td class="px-4 py-3"><StatusBadge status={pr.status} size="sm" /></td>
								<td class="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell">{pr.merged_at ? timeAgo(pr.merged_at) : '--'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

	<!-- ═══════════ COMMITS ═══════════ -->
	{:else if activeTab === 'commits'}
		{#if data.commits.length === 0}
			<div class="mt-12 text-center">
				<GitCommitHorizontal size={48} class="mx-auto text-muted-foreground/40" />
				<p class="mt-4 text-lg font-semibold text-foreground">No commits synced</p>
				<p class="mt-1 text-sm text-muted-foreground">
					Commits on the default branch sync automatically. Large histories may take an extra cycle to fill in.
				</p>
			</div>
		{:else}
			<!-- Mobile cards -->
			<div class="mt-6 space-y-3 sm:hidden">
				{#each data.commits as c}
					<div class="rounded-xl border border-border bg-card p-4">
						<p class="text-sm font-medium text-foreground line-clamp-2">{c.message}</p>
						<div class="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
							<a
								href={commitPageUrl(c.sha)}
								target="_blank"
								rel="noopener noreferrer"
								class="rounded bg-secondary px-1.5 py-0.5 font-mono text-primary hover:underline"
								title={c.sha}
							>{shortSha(c.sha)}</a>
							<span>{c.author}</span>
							<span>{timeAgo(c.committed_at)}</span>
						</div>
					</div>
				{/each}
			</div>

			<!-- Desktop table -->
			<div class="mt-6 hidden overflow-x-auto rounded-xl border border-border sm:block">
				<table class="w-full text-left">
					<thead class="border-b border-border bg-secondary/50">
						<tr>
							<th class="px-4 py-3 text-xs font-semibold text-muted-foreground">SHA</th>
							<th class="px-4 py-3 text-xs font-semibold text-muted-foreground">Message</th>
							<th class="hidden px-4 py-3 text-xs font-semibold text-muted-foreground md:table-cell">Author</th>
							<th class="hidden px-4 py-3 text-xs font-semibold text-muted-foreground md:table-cell">Branch</th>
							<th class="px-4 py-3 text-xs font-semibold text-muted-foreground">Time</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-border">
						{#each data.commits as c}
							<tr class="transition-colors hover:bg-secondary/20">
								<td class="px-4 py-3">
									<a
										href={commitPageUrl(c.sha)}
										target="_blank"
										rel="noopener noreferrer"
										class="rounded bg-secondary px-1.5 py-0.5 text-xs font-mono text-primary hover:underline"
										title={c.sha}
									>{shortSha(c.sha)}</a>
								</td>
								<td class="max-w-[400px] truncate px-4 py-3 text-sm text-foreground">{c.message}</td>
								<td class="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell">{c.author}</td>
								<td class="hidden px-4 py-3 md:table-cell">
									{#if c.branch}
										<code class="rounded bg-secondary px-1.5 py-0.5 text-xs font-mono text-foreground">{c.branch}</code>
									{:else}
										<span class="text-sm text-muted-foreground">--</span>
									{/if}
								</td>
								<td class="px-4 py-3 text-sm text-muted-foreground">{timeAgo(c.committed_at)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}
{/if}

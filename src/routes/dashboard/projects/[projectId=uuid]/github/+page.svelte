<script lang="ts">
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import GitCommitHorizontal from '@lucide/svelte/icons/git-commit-horizontal';
	import GitPullRequest from '@lucide/svelte/icons/git-pull-request';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Badge from '#lib/components/Badge.svelte';
	import DataSection from '#lib/components/DataSection.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Form from '#lib/components/Form.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Time from '#lib/components/Time.svelte';
	import { branchStatus, ciStatus, prStatus } from '#lib/constants.ts';
	import { shortSha } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const repoUrl = $derived(
		data.repo ? `https://github.com/${data.repo.owner}/${data.repo.name}` : ''
	);
</script>

<svelte:head>
	<title>Code (GitHub) · {data.project.name}</title>
</svelte:head>

<PageHeader
	title="Code"
	description={data.repo
		? `Synced from ${data.repo.owner}/${data.repo.name}.`
		: 'Connect a GitHub repository to see branches, commits and pull requests here.'}
>
	{#if data.repo}
		<a href={repoUrl} target="_blank" rel="noreferrer" class="btn">
			Open on GitHub <ExternalLink size={17} />
		</a>
		{#if data.canEdit}
			<Form action="?/sync">
				{#snippet children({ pending })}
					<button type="submit" class="btn btn-primary" disabled={pending}>
						<RefreshCw size={18} class={pending ? 'animate-spin' : ''} />
						{pending ? 'Syncing…' : 'Sync now'}
					</button>
				{/snippet}
			</Form>
		{/if}
	{/if}
</PageHeader>

{#if !data.repo}
	<EmptyState title="GitHub is not connected" message="Connect a repository and this page fills itself in.">
		{#if data.canEdit}
			<a href="/dashboard/projects/{data.project.id}/integrations" class="btn btn-primary">
				Connect GitHub
			</a>
		{/if}
	</EmptyState>
{:else}
	<p class="mb-8 text-muted">
		Last synced <Time value={data.repo.lastSyncAt} relative fallback="never" />. Sync pulls the latest
		branches, commits, pull requests, workflow runs and deployments.
	</p>

	{#if data.recentRuns.length}
		<section class="mb-8">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-xl">Latest builds</h2>
				<a href="/dashboard/projects/{data.project.id}/ci" class="btn btn-ghost btn-sm">See all</a>
			</div>
			<div class="flex gap-3 overflow-x-auto pb-1">
				{#each data.recentRuns as run (run.id)}
					<div class="tile flex min-w-64 items-center gap-3 px-4 py-3">
						<Badge option={ciStatus(run.status)} />
						<span class="min-w-0">
							<span class="block truncate font-semibold">{run.workflow_name}</span>
							<span class="block truncate text-[0.85rem] text-muted">{run.branch || 'no branch'}</span>
						</span>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<div class="grid gap-8">
		<DataSection
			title="Pull requests"
			noun="pull request"
			rows={data.pulls.map((pull) => ({ ...pull, id: String(pull.id) }))}
			searchFrom={12}
			columns={[
				{
					key: 'title',
					label: 'Pull request',
					primary: true,
					sub: (row) => `#${row.gh_number} by ${row.author}${row.branch ? ` · ${row.branch}` : ''}`
				},
				{ key: 'status', label: 'Status', kind: 'badge', option: prStatus },
				{ key: 'created_at', label: 'Opened', kind: 'time' }
			]}
			emptyTitle="No pull requests"
			emptyMessage="Pull requests appear here after the next sync."
		>
			{#snippet rowActions(row)}
				<a
					href="{repoUrl}/pull/{row.gh_number}"
					target="_blank"
					rel="noreferrer"
					class="btn btn-ghost btn-sm btn-icon"
					aria-label="Open pull request #{row.gh_number} on GitHub"
					title="Open on GitHub"
				>
					<GitPullRequest size={17} />
				</a>
			{/snippet}
		</DataSection>

		<DataSection
			title="Branches"
			noun="branch"
			rows={data.branches}
			columns={[
				{ key: 'name', label: 'Branch', primary: true, kind: 'mono' },
				{ key: 'last_commit_sha', label: 'Latest commit', kind: 'mono', value: (row) => shortSha(String(row.last_commit_sha ?? '')) },
				{ key: 'status', label: 'Status', kind: 'badge', option: branchStatus },
				{ key: 'updated_at', label: 'Updated', kind: 'time' }
			]}
			emptyTitle="No branches"
			emptyMessage="Branches appear here after the next sync."
		/>

		<DataSection
			title="Commits"
			noun="commit"
			rows={data.commits}
			searchFrom={12}
			columns={[
				{
					key: 'message',
					label: 'Commit',
					primary: true,
					value: (row) => String(row.message ?? '').split('\n')[0],
					sub: (row) => `${shortSha(String(row.sha ?? ''))} · ${row.author}`
				},
				{ key: 'committed_at', label: 'When', kind: 'time' }
			]}
			emptyTitle="No commits"
			emptyMessage="Commits appear here after the next sync."
		>
			{#snippet rowActions(row)}
				<a
					href="{repoUrl}/commit/{row.sha}"
					target="_blank"
					rel="noreferrer"
					class="btn btn-ghost btn-sm btn-icon"
					aria-label="Open commit {shortSha(String(row.sha ?? ''))} on GitHub"
					title="Open on GitHub"
				>
					<GitCommitHorizontal size={17} />
				</a>
			{/snippet}
		</DataSection>
	</div>
{/if}

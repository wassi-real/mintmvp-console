<script lang="ts">
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import DataSection from '#lib/components/DataSection.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Stat from '#lib/components/Stat.svelte';
	import { ciStatus } from '#lib/constants.ts';
	import { percent, shortSha } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Builds (CI/CD) · {data.project.name}</title>
</svelte:head>

<PageHeader
	title="Builds"
	description="Workflow runs synced from GitHub. A failed build means the latest changes did not pass their checks."
>
	{#if data.canEdit}
		<a href="/dashboard/projects/{data.project.id}/github" class="btn">Sync from GitHub</a>
	{/if}
</PageHeader>

<div class="stagger mb-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
	<Stat label="Pass rate" value="{percent(data.counts.passed, data.counts.total)}%" detail="{data.counts.passed} of {data.counts.total}" />
	<Stat label="Passed" value={data.counts.passed} tone={data.counts.passed ? 'ok' : 'neutral'} />
	<Stat label="Failed" value={data.counts.failed} tone={data.counts.failed ? 'bad' : 'neutral'} />
	<Stat label="Running or queued" value={data.counts.running} tone={data.counts.running ? 'warn' : 'neutral'} />
</div>

<DataSection
	title="Workflow runs"
	noun="run"
	rows={data.runs}
	searchFrom={12}
	columns={[
		{ key: 'workflow_name', label: 'Workflow', primary: true, sub: (row) => String(row.branch ?? '') },
		{ key: 'status', label: 'Result', kind: 'badge', option: ciStatus },
		{ key: 'commit_sha', label: 'Commit', kind: 'mono', value: (row) => shortSha(String(row.commit_sha ?? '')) },
		{ key: 'created_at', label: 'Started', kind: 'time' }
	]}
	emptyTitle="No builds yet"
	emptyMessage="Runs appear here after you sync from GitHub."
>
	{#snippet rowActions(row)}
		{#if data.repoUrl}
			<a
				href="{data.repoUrl}/actions/runs/{row.gh_run_id}"
				target="_blank"
				rel="noreferrer"
				class="btn btn-ghost btn-sm btn-icon"
				aria-label="Open this run on GitHub"
				title="Open on GitHub"
			>
				<ExternalLink size={17} />
			</a>
		{/if}
	{/snippet}
</DataSection>

<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Time from '#lib/components/Time.svelte';
	import { formatNumber, initials } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const base = $derived(`/dashboard/projects/${data.project.id}/activity`);
</script>

<svelte:head>
	<title>Activity · {data.project.name}</title>
</svelte:head>

<PageHeader
	title="Activity"
	description="Everything that has changed in this project. {formatNumber(data.total)} events in total."
/>

{#if data.entries.length === 0}
	<EmptyState title="No activity yet" message="Creating, editing and deleting things is recorded here." />
{:else}
	<ol class="list">
		{#each data.entries as entry (entry.id)}
			<li class="list-row items-start!">
				<span
					class="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[0.85rem] font-bold"
					aria-hidden="true"
				>
					{initials(entry.actor)}
				</span>
				<div class="min-w-0 flex-1">
					<p class="wrap-break-word font-medium">{entry.action}</p>
					<p class="mt-0.5 text-[0.9rem] text-muted">
						{entry.actor} · <Time value={entry.created_at} relative />
					</p>
				</div>
			</li>
		{/each}
	</ol>

	{#if data.pages > 1}
		<nav class="mt-6 flex items-center justify-between gap-4" aria-label="Pages">
			{#if data.page > 1}
				<a href="{base}?page={data.page - 1}" class="btn"><ChevronLeft size={18} /> Newer</a>
			{:else}
				<span></span>
			{/if}
			<span class="text-muted tabular-nums">Page {data.page} of {data.pages}</span>
			{#if data.page < data.pages}
				<a href="{base}?page={data.page + 1}" class="btn">Older <ChevronRight size={18} /></a>
			{/if}
		</nav>
	{/if}
{/if}

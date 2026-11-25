<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import { page } from '$app/state';
	import Badge from '#lib/components/Badge.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import RecordDialog from '#lib/components/RecordDialog.svelte';
	import Time from '#lib/components/Time.svelte';
	import { workState } from '#lib/constants.ts';
	import type { Field } from '#lib/fields.ts';
	import { PLAN_FIELDS } from '#lib/work-rules.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const base = $derived(`/dashboard/projects/${data.project.id}`);
	let creating = $state(page.url.searchParams.get('new') === '1');

	const fields: readonly Field[] = [
		...PLAN_FIELDS,
		{
			name: 'approve',
			label: 'Approve this plan now, so agents can start',
			type: 'checkbox',
			initial: true,
			wide: true
		}
	];

	const filters = [
		{ value: 'open', label: 'Open' },
		{ value: 'released', label: 'Released' },
		{ value: 'dropped', label: 'Dropped' },
		{ value: 'all', label: 'All' }
	];

	function claimLine(item: (typeof data.items)[number]): string {
		if (item.claimed_by && item.claim_until && Date.parse(item.claim_until) > Date.now()) {
			return `Claimed by ${item.claimed_by}`;
		}
		return item.created_by ? `From ${item.created_by}` : '';
	}
</script>

<svelte:head>
	<title>Work · {data.project.name}</title>
</svelte:head>

<PageHeader
	title="Work"
	description="One piece of work is a plan you approve, the agent that holds it, the checks it ran and the version it shipped in."
>
	{#if data.canEdit}
		<button type="button" class="btn btn-primary" onclick={() => (creating = true)}>
			<Plus size={18} /> New work
		</button>
	{/if}
</PageHeader>

{#if !data.ready}
	<p class="notice notice-warn mb-8">
		The work loop is not in the database yet. Apply the migration
		<code class="mono">20261125120000_work_loop_and_api_limits.sql</code> in the Supabase SQL editor, then refresh.
	</p>
{/if}

<nav class="seg mb-6" aria-label="Filter work">
	{#each filters as filter (filter.value)}
		<a
			href="?show={filter.value}"
			class="seg-item"
			aria-current={data.show === filter.value ? 'page' : undefined}
			data-sveltekit-replacestate
		>
			{filter.label}
		</a>
	{/each}
</nav>

{#if data.items.length === 0}
	<EmptyState
		title={data.show === 'open' ? 'No open work' : 'Nothing here yet'}
		message="Write a plan yourself, or let your agent create one through the API. You approve it, and any agent can pick it up."
	>
		{#if data.canEdit}
			<button type="button" class="btn btn-primary" onclick={() => (creating = true)}>
				<Plus size={18} /> New work
			</button>
			<a href="{base}/api-keys" class="btn">Connect agent</a>
		{/if}
	</EmptyState>
{:else}
	<div class="list">
		{#each data.items as item (item.id)}
			<a href="{base}/work/{item.id}" class="list-row flex-wrap">
				<span class="min-w-0 flex-1">
					<span class="block font-semibold wrap-break-word">{item.title}</span>
					<span class="block text-[0.9rem] text-muted wrap-break-word">
						{#if claimLine(item)}{claimLine(item)} · {/if}
						{#if item.next_action}Next: {item.next_action} · {/if}
						Updated <Time value={item.updated_at} relative />
					</span>
				</span>
				{#if item.plan_version > 1}
					<span class="chip text-muted">Plan v{item.plan_version}</span>
				{/if}
				<Badge option={workState(item.state)} />
			</a>
		{/each}
	</div>
	{#if data.count > data.items.length}
		<p class="mt-4 text-muted">Showing the latest {data.items.length} of {data.count}.</p>
	{/if}
{/if}

<RecordDialog bind:open={creating} noun="work" {fields} size="lg" />

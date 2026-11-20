<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import Badge from '#lib/components/Badge.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import RecordDialog from '#lib/components/RecordDialog.svelte';
	import { milestonePhase, milestonePriority } from '#lib/constants.ts';
	import { formatDate, isOverdue, percent } from '#lib/format.ts';
	import { milestoneFields } from '#lib/sections.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let creating = $state(false);
	let filter = $state<'open' | 'done' | 'all'>('open');

	const fields = $derived(milestoneFields({ members: data.members, specs: data.specs }));
	const finished = $derived(data.milestones.filter((milestone) => milestone.finished).length);
	const shown = $derived(
		data.milestones.filter((milestone) =>
			filter === 'all' ? true : filter === 'done' ? milestone.finished : !milestone.finished
		)
	);
</script>

<svelte:head>
	<title>Milestones · {data.project.name}</title>
</svelte:head>

<PageHeader title="Milestones" description="The big checkpoints on the way to finishing this project.">
	{#if data.canEdit}
		<button type="button" class="btn btn-primary" onclick={() => (creating = true)}>
			<Plus size={20} /> New milestone
		</button>
	{/if}
</PageHeader>

{#if data.milestones.length === 0}
	<EmptyState title="No milestones yet" message="Add checkpoints such as “Design approved” or “First release”.">
		{#if data.canEdit}
			<button type="button" class="btn btn-primary btn-lg" onclick={() => (creating = true)}>
				<Plus size={20} /> Add the first milestone
			</button>
		{/if}
	</EmptyState>
{:else}
	<div class="mb-7 flex flex-wrap items-center justify-between gap-4">
		<div class="seg" role="group" aria-label="Show milestones">
			<button type="button" class="seg-item" aria-pressed={filter === 'open'} onclick={() => (filter = 'open')}>
				In progress ({data.milestones.length - finished})
			</button>
			<button type="button" class="seg-item" aria-pressed={filter === 'done'} onclick={() => (filter = 'done')}>
				Finished ({finished})
			</button>
			<button type="button" class="seg-item" aria-pressed={filter === 'all'} onclick={() => (filter = 'all')}>All</button>
		</div>
		<div class="min-w-56 flex-1 sm:max-w-xs">
			<div class="mb-1.5 flex justify-between text-[0.88rem] text-muted">
				<span>Overall</span>
				<span class="font-semibold text-fg tabular-nums">{percent(finished, data.milestones.length)}%</span>
			</div>
			<div class="progress" aria-hidden="true"><span style="width: {percent(finished, data.milestones.length)}%"></span></div>
		</div>
	</div>

	{#if shown.length === 0}
		<EmptyState title="Nothing in this view" message="Choose a different view above." />
	{:else}
		{#key filter}
			<div class="stagger grid gap-5 lg:grid-cols-2">
				{#each shown as milestone (milestone.id)}
					<a href="/dashboard/projects/{data.project.id}/milestones/{milestone.id}" class="tile flex flex-col p-6">
						<div class="flex items-start justify-between gap-3">
							<h2 class="text-xl">{milestone.title}</h2>
							<Badge option={milestonePhase(milestone.phase)} />
						</div>
						{#if milestone.description}
							<p class="mt-2 line-clamp-2 text-muted">{milestone.description}</p>
						{/if}

						<div class="mt-5 flex-1">
							{#if milestone.steps.total > 0}
								<div class="mb-1.5 flex justify-between text-[0.88rem] text-muted">
									<span>{milestone.steps.done} of {milestone.steps.total} steps done</span>
									<span class="font-semibold text-fg tabular-nums">{percent(milestone.steps.done, milestone.steps.total)}%</span>
								</div>
								<div class="progress" aria-hidden="true">
									<span style="width: {percent(milestone.steps.done, milestone.steps.total)}%"></span>
								</div>
							{:else}
								<p class="text-[0.9rem] text-faint">No steps added yet.</p>
							{/if}
						</div>

						<div class="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.9rem] text-muted">
							{#if milestone.priority !== 'p3_normal'}
								<Badge option={{ ...milestonePriority(milestone.priority), label: `${milestonePriority(milestone.priority).label} priority` }} />
							{/if}
							<span class={isOverdue(milestone.due_date) && !milestone.finished ? 'font-semibold text-bad' : ''}>
								{milestone.due_date ? `Due ${formatDate(milestone.due_date)}` : 'No due date'}
							</span>
							{#if milestone.ownerName}<span>Owner: {milestone.ownerName}</span>{/if}
						</div>
					</a>
				{/each}
			</div>
		{/key}
	{/if}
{/if}

{#if data.canEdit}
	<RecordDialog bind:open={creating} noun="milestone" {fields} size="lg" />
{/if}
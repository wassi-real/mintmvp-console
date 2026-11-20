<script lang="ts">
	import Badge from '#lib/components/Badge.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { milestonePriority } from '#lib/constants.ts';
	import { formatDate, isOverdue, percent } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const base = $derived(`/dashboard/projects/${data.project.id}/milestones`);
</script>

<svelte:head>
	<title>Pipeline · {data.project.name}</title>
</svelte:head>

<PageHeader
	title="Pipeline"
	description="Every milestone, grouped by the stage it is in. {data.finished} of {data.total} are finished."
/>

{#if data.total === 0}
	<EmptyState title="No milestones yet" message="The pipeline fills up as you add milestones.">
		{#if data.canEdit}
			<a href="{base}" class="btn btn-primary">Go to milestones</a>
		{/if}
	</EmptyState>
{:else}
	<div class="mb-8 max-w-md">
		<div class="mb-2 flex justify-between text-[0.95rem] text-muted">
			<span>Finished</span>
			<span class="font-semibold text-fg tabular-nums">{percent(data.finished, data.total)}%</span>
		</div>
		<div class="progress" aria-hidden="true">
			<span style="width: {percent(data.finished, data.total)}%"></span>
		</div>
	</div>

	<ol class="grid gap-6">
		{#each data.stages as stage, index (stage.value)}
			<li class="panel">
				<header class="panel-header">
					<h2 class="panel-title flex items-center gap-3">
						<span
							class="flex size-8 items-center justify-center rounded-full text-[0.85rem] font-bold tabular-nums {stage.milestones.every(
								(milestone) => milestone.finished
							)
								? 'bg-ok text-bg'
								: 'bg-surface-3 text-fg'}"
						>
							{index + 1}
						</span>
						{stage.label}
					</h2>
					<span class="chip text-muted tabular-nums">{stage.milestones.length}</span>
				</header>
				<ul>
					{#each stage.milestones as milestone (milestone.id)}
						<li>
							<a href="{base}/{milestone.id}" class="list-row flex-wrap">
								<span class="min-w-0 flex-1">
									<span class="block truncate font-semibold">{milestone.title}</span>
									{#if milestone.steps.total > 0}
										<span class="mt-1.5 flex max-w-xs items-center gap-3">
											<span class="progress flex-1" aria-hidden="true">
												<span style="width: {percent(milestone.steps.done, milestone.steps.total)}%"></span>
											</span>
											<span class="text-[0.82rem] text-muted tabular-nums">
												{milestone.steps.done}/{milestone.steps.total}
											</span>
										</span>
									{/if}
								</span>
								<span class="flex flex-wrap items-center gap-2.5">
									{#if milestone.priority !== 'p3_normal'}
										<Badge option={milestonePriority(milestone.priority)} />
									{/if}
									<span class="text-[0.9rem] whitespace-nowrap {isOverdue(milestone.due_date) && !milestone.finished ? 'font-semibold text-bad' : 'text-muted'}">
										{milestone.due_date ? `Due ${formatDate(milestone.due_date)}` : 'No due date'}
									</span>
								</span>
							</a>
						</li>
					{/each}
				</ul>
			</li>
		{/each}
	</ol>
{/if}

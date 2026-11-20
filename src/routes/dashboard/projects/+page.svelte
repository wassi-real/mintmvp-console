<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import Badge from '#lib/components/Badge.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import RecordDialog from '#lib/components/RecordDialog.svelte';
	import { PROJECT_STATUSES, priority, projectStatus } from '#lib/constants.ts';
	import { formatDate, isOverdue, percent } from '#lib/format.ts';
	import { projectFields } from '#lib/sections.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let creating = $state(false);
	let filter = $state('current');

	$effect(() => {
		if (data.openNew && data.canEdit) creating = true;
	});

	const shown = $derived(
		data.list.filter((project) =>
			filter === 'current'
				? project.status !== 'archived' && project.status !== 'completed'
				: filter === 'all'
					? true
					: project.status === filter
		)
	);
</script>

<svelte:head>
	<title>Projects · {data.workspace.name}</title>
</svelte:head>

<PageHeader title="Projects" description="Everything your workspace is working on.">
	{#if data.canEdit}
		<button type="button" class="btn btn-primary" onclick={() => (creating = true)}>
			<Plus size={20} /> New project
		</button>
	{/if}
</PageHeader>

{#if data.list.length === 0}
	<EmptyState
		title="No projects yet"
		message="A project holds the tasks, milestones, reports and delivery details for one piece of work."
	>
		{#if data.canEdit}
			<button type="button" class="btn btn-primary btn-lg" onclick={() => (creating = true)}>
				<Plus size={20} /> Create your first project
			</button>
		{/if}
	</EmptyState>
{:else}
	<div class="mb-7 max-w-full overflow-x-auto">
		<div class="seg" role="group" aria-label="Show projects">
			<button type="button" class="seg-item" aria-pressed={filter === 'current'} onclick={() => (filter = 'current')}>
				Current
			</button>
			{#each PROJECT_STATUSES.filter((s) => s.value === 'completed' || s.value === 'archived') as option (option.value)}
				<button
					type="button"
					class="seg-item"
					aria-pressed={filter === option.value}
					onclick={() => (filter = option.value)}
				>
					{option.label}
				</button>
			{/each}
			<button type="button" class="seg-item" aria-pressed={filter === 'all'} onclick={() => (filter = 'all')}>
				All
			</button>
		</div>
	</div>

	{#if shown.length === 0}
		<EmptyState title="No projects in this view" message="Choose a different view above." />
	{:else}
		{#key filter}
			<div class="stagger grid gap-5 md:grid-cols-2 xl:grid-cols-3">
				{#each shown as project (project.id)}
					{@const total = project.openTasks + project.doneTasks}
					<a href="/dashboard/projects/{project.id}" class="tile flex flex-col p-6">
						<div class="flex items-start justify-between gap-3">
							<h2 class="text-xl">{project.name}</h2>
							<Badge option={projectStatus(project.status)} />
						</div>
						<p class="mt-2 line-clamp-2 flex-1 text-muted">
							{project.description || 'No description yet.'}
						</p>

						<div class="mt-6">
							<div class="mb-2 flex items-center justify-between text-[0.88rem] text-muted">
								<span>{project.doneTasks} of {total} tasks done</span>
								<span class="font-semibold text-fg tabular-nums">
									{percent(project.doneTasks, total)}%
								</span>
							</div>
							<div class="progress" aria-hidden="true">
								<span style="width: {percent(project.doneTasks, total)}%"></span>
							</div>
						</div>

						<div class="mt-5 flex flex-wrap items-center gap-2">
							<Badge option={{ ...priority(project.priority), label: `${priority(project.priority).label} priority` }} />
							{#if project.target_date}
								<span class="text-[0.88rem] {isOverdue(project.target_date) ? 'font-semibold text-bad' : 'text-muted'}">
									Target {formatDate(project.target_date)}
								</span>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		{/key}
	{/if}
{/if}

{#if data.canEdit}
	<RecordDialog bind:open={creating} noun="project" fields={projectFields} size="lg" />
{/if}

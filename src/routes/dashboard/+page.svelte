<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import Badge from '#lib/components/Badge.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import NeedsYou from '#lib/components/NeedsYou.svelte';
	import Time from '#lib/components/Time.svelte';
	import { projectStatus } from '#lib/constants.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const firstName = $derived(data.me.name.split(' ')[0]);
</script>

<svelte:head>
	<title>Today · {data.workspace.name}</title>
</svelte:head>

<header class="mb-10 flex flex-wrap items-end justify-between gap-5">
	<div>
		<p class="eyebrow">{data.workspace.name}</p>
		<h1 class="mt-2 text-4xl sm:text-5xl">Hello, {firstName}</h1>
		<p class="mt-3 text-lg text-muted">
			{#if data.needs.length === 0}
				Nothing needs you. Your agents can keep going.
			{:else if data.needs.length === 1}
				One thing needs you. Everything else is moving on its own.
			{:else}
				{data.needs.length} things need you. Everything else is moving on its own.
			{/if}
		</p>
	</div>
	{#if data.canEdit}
		<a href="/dashboard/projects?new=1" class="btn btn-primary"><Plus size={20} /> New project</a>
	{/if}
</header>

{#if data.projects.length === 0}
	<EmptyState
		title="Create your first project"
		message="A project is one product. You approve plans, your agents do the work, and Mint keeps the record."
	>
		{#if data.canEdit}
			<a href="/dashboard/projects?new=1" class="btn btn-primary btn-lg">
				<Plus size={20} /> New project
			</a>
		{:else}
			<p class="text-muted">Ask a workspace owner to add a project.</p>
		{/if}
	</EmptyState>
{:else}
	{#if !data.workReady}
		<p class="notice notice-warn mb-8">
			The work loop is not in the database yet. Apply the migration
			<code class="mono">20261125120000_work_loop_and_api_limits.sql</code> in the Supabase SQL editor, then refresh.
		</p>
	{/if}

	{#if data.needs.length}
		<section class="mb-12">
			<h2 class="mb-4 text-2xl">Needs you</h2>
			<NeedsYou cards={data.needs} canEdit={data.canEdit} projectNames={data.projectNames} />
		</section>
	{/if}

	<section class="mb-12">
		<h2 class="mb-4 text-2xl">Projects</h2>
		<div class="stagger grid gap-5 md:grid-cols-2 xl:grid-cols-3">
			{#each data.projects as project (project.id)}
				<a href="/dashboard/projects/{project.id}" class="tile flex flex-col p-6">
					<div class="flex items-start justify-between gap-3">
						<h3 class="text-xl wrap-break-word">{project.name}</h3>
						<Badge option={projectStatus(project.status)} />
					</div>
					<p class="mt-2 line-clamp-2 flex-1 text-muted">{project.description || 'No description yet.'}</p>
					<div class="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.92rem] text-muted">
						<span class={project.needs ? 'font-semibold text-bad' : ''}>
							<strong class="tabular-nums {project.needs ? '' : 'text-fg'}">{project.needs}</strong> need you
						</span>
						<span><strong class="text-fg tabular-nums">{project.moving}</strong> moving</span>
					</div>
				</a>
			{/each}
		</div>
	</section>

	<div class="grid gap-8 xl:grid-cols-2">
		<section>
			<h2 class="mb-4 text-2xl">Recent history</h2>
			{#if data.activity.length === 0}
				<p class="text-muted">Changes from you and your agents show up here.</p>
			{:else}
				<div class="list">
					{#each data.activity as entry (entry.id)}
						<a href="/dashboard/projects/{entry.project_id}/activity" class="list-row">
							<span class="min-w-0 flex-1">
								<span class="line-clamp-1 font-medium">{entry.action}</span>
								<span class="block truncate text-[0.88rem] text-muted">
									{entry.actor} · {data.projectNames[entry.project_id]} · <Time value={entry.created_at} relative />
								</span>
							</span>
						</a>
					{/each}
				</div>
			{/if}
		</section>
	</div>
{/if}

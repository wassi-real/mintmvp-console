<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Plus from '@lucide/svelte/icons/plus';
	import Badge from '#lib/components/Badge.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Stat from '#lib/components/Stat.svelte';
	import Time from '#lib/components/Time.svelte';
	import {
		incidentSeverity,
		milestonePhase,
		priority,
		projectStatus,
		taskStatus
	} from '#lib/constants.ts';
	import { formatDate, isOverdue } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const firstName = $derived(data.me.name.split(' ')[0]);
</script>

<svelte:head>
	<title>Overview · {data.workspace.name}</title>
</svelte:head>

<header class="mb-10 flex flex-wrap items-end justify-between gap-5">
	<div>
		<p class="eyebrow">{data.workspace.name}</p>
		<h1 class="mt-2 text-4xl sm:text-5xl">Hello, {firstName}</h1>
		<p class="mt-3 text-lg text-muted">Here is what needs your attention today.</p>
	</div>
	{#if data.canEdit}
		<a href="/dashboard/projects?new=1" class="btn btn-primary"><Plus size={20} /> New project</a>
	{/if}
</header>

{#if !data.totals}
	<EmptyState
		title="Create your first project"
		message="A project holds the tasks, milestones, reports and delivery details for one piece of work."
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
	<div class="stagger grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
		<Stat label="Active projects" value={data.totals.activeProjects} href="/dashboard/projects" />
		<Stat label="Open tasks" value={data.totals.openTasks} detail="Across all projects" />
		<Stat
			label="Overdue tasks"
			value={data.totals.overdueTasks}
			tone={data.totals.overdueTasks > 0 ? 'bad' : 'neutral'}
			detail={data.totals.overdueTasks > 0 ? 'Past their due date' : 'Nothing is late'}
		/>
		<Stat
			label="Open incidents"
			value={data.totals.openIncidents}
			tone={data.totals.openIncidents > 0 ? 'warn' : 'neutral'}
			detail={data.totals.openIncidents > 0 ? 'Need attention' : 'All clear'}
		/>
	</div>

	<section class="mt-12">
		<div class="mb-5 flex items-center justify-between gap-4">
			<h2 class="text-2xl">Projects</h2>
			<a href="/dashboard/projects" class="btn btn-ghost btn-sm">See all <ArrowRight size={17} /></a>
		</div>
		<div class="stagger grid gap-5 md:grid-cols-2 xl:grid-cols-3">
			{#each data.projects as project (project.id)}
				<a href="/dashboard/projects/{project.id}" class="tile flex flex-col p-6">
					<div class="flex items-start justify-between gap-3">
						<h3 class="text-xl">{project.name}</h3>
						<Badge option={projectStatus(project.status)} />
					</div>
					<p class="mt-2 line-clamp-2 flex-1 text-muted">
						{project.description || 'No description yet.'}
					</p>
					<div class="mt-5 flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.92rem] text-muted">
						<span><strong class="text-fg tabular-nums">{project.openTasks}</strong> open tasks</span>
						{#if project.target_date}
							<span class={isOverdue(project.target_date) ? 'font-semibold text-bad' : ''}>
								Target {formatDate(project.target_date)}
							</span>
						{/if}
					</div>
				</a>
			{/each}
		</div>
	</section>

	<div class="mt-12 grid gap-8 xl:grid-cols-2">
		<section>
			<h2 class="mb-5 text-2xl">Your tasks</h2>
			{#if data.myTasks.length === 0}
				<EmptyState title="Nothing assigned to you" message="Tasks assigned to you will show up here." />
			{:else}
				<div class="list">
					{#each data.myTasks as task (task.id)}
						<a href="/dashboard/projects/{task.project_id}/tasks/{task.id}" class="list-row">
							<span class="min-w-0 flex-1">
								<span class="block truncate font-semibold">{task.title}</span>
								<span class="block truncate text-[0.88rem] text-muted">
									{task.projectName}
									{#if task.due_date}
										· <span class={isOverdue(task.due_date) ? 'font-semibold text-bad' : ''}>
											Due {formatDate(task.due_date)}
										</span>
									{/if}
								</span>
							</span>
							{#if task.priority === 'high'}<Badge option={priority(task.priority)} />{/if}
							<Badge option={taskStatus(task.status)} />
						</a>
					{/each}
				</div>
			{/if}
		</section>

		<section>
			<h2 class="mb-5 text-2xl">Upcoming milestones</h2>
			{#if data.milestones.length === 0}
				<EmptyState title="No upcoming milestones" message="Milestones with a due date will show up here." />
			{:else}
				<div class="list">
					{#each data.milestones as milestone (milestone.id)}
						<a
							href="/dashboard/projects/{milestone.project_id}/milestones/{milestone.id}"
							class="list-row"
						>
							<span class="min-w-0 flex-1">
								<span class="block truncate font-semibold">{milestone.title}</span>
								<span class="block truncate text-[0.88rem] text-muted">
									{milestone.projectName} ·
									<span class={isOverdue(milestone.due_date) ? 'font-semibold text-bad' : ''}>
										Due {formatDate(milestone.due_date)}
									</span>
								</span>
							</span>
							<Badge option={milestonePhase(milestone.phase)} />
						</a>
					{/each}
				</div>
			{/if}
		</section>

		<section>
			<h2 class="mb-5 text-2xl">Open incidents</h2>
			{#if data.incidents.length === 0}
				<EmptyState title="No open incidents" message="Problems reported in any project will show up here." />
			{:else}
				<div class="list">
					{#each data.incidents.slice(0, 6) as incident (incident.id)}
						<a href="/dashboard/projects/{incident.project_id}/incidents" class="list-row">
							<span class="min-w-0 flex-1">
								<span class="block truncate font-semibold">{incident.title}</span>
								<span class="block truncate text-[0.88rem] text-muted">
									{incident.projectName} · <Time value={incident.created_at} relative />
								</span>
							</span>
							<Badge option={incidentSeverity(incident.severity)} />
						</a>
					{/each}
				</div>
			{/if}
		</section>

		<section>
			<h2 class="mb-5 text-2xl">Recent activity</h2>
			{#if data.activity.length === 0}
				<EmptyState title="No activity yet" message="Changes made in your projects will show up here." />
			{:else}
				<div class="list">
					{#each data.activity.slice(0, 6) as entry (entry.id)}
						<a href="/dashboard/projects/{entry.project_id}/activity" class="list-row">
							<span class="min-w-0 flex-1">
								<span class="line-clamp-1 font-medium">{entry.action}</span>
								<span class="block truncate text-[0.88rem] text-muted">
									{entry.actor} · {entry.projectName} · <Time value={entry.created_at} relative />
								</span>
							</span>
						</a>
					{/each}
				</div>
			{/if}
		</section>
	</div>
{/if}

<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Badge from '#lib/components/Badge.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Stat from '#lib/components/Stat.svelte';
	import Time from '#lib/components/Time.svelte';
	import {
		TASK_STATUSES,
		environmentKind,
		environmentStatus,
		incidentSeverity,
		milestonePhase,
		priority,
		projectStatus,
		uptimeStatus
	} from '#lib/constants.ts';
	import { formatDate, isOverdue, percent } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const base = $derived(`/dashboard/projects/${data.project.id}`);
	const uptime = $derived(uptimeStatus(data.health?.uptime_status ?? 'unknown'));
	const links = $derived(
		[
			{ label: 'Live site', url: data.project.production_url },
			{ label: 'Staging site', url: data.project.staging_url },
			{ label: 'Code repository', url: data.project.repo_url }
		].filter((link): link is { label: string; url: string } => Boolean(link.url))
	);
</script>

<svelte:head>
	<title>{data.project.name} · MintMVP Console</title>
</svelte:head>

<header class="mb-10">
	<div class="flex flex-wrap items-center gap-3">
		<Badge option={projectStatus(data.project.status)} />
		<Badge option={{ ...priority(data.project.priority), label: `${priority(data.project.priority).label} priority` }} />
		{#if data.project.target_date}
			<span class="chip {isOverdue(data.project.target_date) && data.project.status === 'active' ? 'text-bad' : 'text-muted'}">
				Target {formatDate(data.project.target_date)}
			</span>
		{/if}
	</div>
	<h1 class="mt-4 text-4xl sm:text-5xl">{data.project.name}</h1>
	{#if data.project.description}
		<p class="mt-3 max-w-3xl text-lg text-muted">{data.project.description}</p>
	{/if}
	{#if links.length}
		<div class="mt-6 flex flex-wrap gap-3">
			{#each links as link (link.label)}
				<a href={link.url} target="_blank" rel="noreferrer" class="btn btn-sm">
					{link.label} <ExternalLink size={15} />
				</a>
			{/each}
		</div>
	{/if}
</header>

<div class="stagger grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
	<Stat
		label="Tasks done"
		value="{percent(data.doneTasks, data.totalTasks)}%"
		detail="{data.doneTasks} of {data.totalTasks} tasks"
		href="{base}/tasks"
	/>
	<Stat
		label="Milestones"
		value="{data.milestonesDone}/{data.milestonesTotal}"
		detail="Finished"
		href="{base}/milestones"
	/>
	<Stat
		label="Open incidents"
		value={data.incidents.length}
		tone={data.incidents.length > 0 ? 'bad' : 'neutral'}
		detail={data.incidents.length > 0 ? 'Need attention' : 'All clear'}
		href="{base}/incidents"
	/>
	<Stat
		label="Site status"
		value={uptime.label}
		tone={uptime.tone}
		detail={data.health?.last_check_at ? 'Checked recently' : 'No checks yet'}
		href="{base}/monitoring"
	/>
</div>

<div class="mt-10 grid gap-8 xl:grid-cols-2">
	<section class="panel">
		<header class="panel-header">
			<h2 class="panel-title">Tasks by stage</h2>
			<a href="{base}/tasks?view=board" class="btn btn-ghost btn-sm">Open board <ArrowRight size={16} /></a>
		</header>
		<div class="panel-body grid gap-4">
			{#if data.totalTasks === 0}
				<p class="text-muted">No tasks yet. <a class="link text-fg" href="{base}/tasks">Add the first task</a>.</p>
			{:else}
				{#each TASK_STATUSES as status (status.value)}
					{@const count = data.taskCounts[status.value] ?? 0}
					<div>
						<div class="mb-1.5 flex items-center justify-between text-[0.95rem]">
							<span class="font-semibold">{status.label}</span>
							<span class="text-muted tabular-nums">{count}</span>
						</div>
						<div class="progress" aria-hidden="true">
							<span style="width: {percent(count, data.totalTasks)}%"></span>
						</div>
					</div>
				{/each}
				{#if data.overdueTasks > 0}
					<p class="notice notice-warn">
						{data.overdueTasks} {data.overdueTasks === 1 ? 'task is' : 'tasks are'} past the due date.
					</p>
				{/if}
			{/if}
		</div>
	</section>

	<section class="panel">
		<header class="panel-header">
			<h2 class="panel-title">Next milestones</h2>
			<a href="{base}/milestones" class="btn btn-ghost btn-sm">See all <ArrowRight size={16} /></a>
		</header>
		{#if data.nextMilestones.length === 0}
			<div class="panel-body text-muted">No milestones in progress.</div>
		{:else}
			<div>
				{#each data.nextMilestones as milestone (milestone.id)}
					<a href="{base}/milestones/{milestone.id}" class="list-row">
						<span class="min-w-0 flex-1">
							<span class="block truncate font-semibold">{milestone.title}</span>
							<span class="block text-[0.88rem] {isOverdue(milestone.due_date) ? 'font-semibold text-bad' : 'text-muted'}">
								{milestone.due_date ? `Due ${formatDate(milestone.due_date)}` : 'No due date'}
							</span>
						</span>
						<Badge option={milestonePhase(milestone.phase)} />
					</a>
				{/each}
			</div>
		{/if}
	</section>

	<section class="panel">
		<header class="panel-header">
			<h2 class="panel-title">Environments</h2>
			<a href="{base}/environments" class="btn btn-ghost btn-sm">Manage <ArrowRight size={16} /></a>
		</header>
		{#if data.environments.length === 0}
			<div class="panel-body text-muted">No environments set up.</div>
		{:else}
			<div>
				{#each data.environments as environment (environment.id)}
					<div class="list-row">
						<span class="min-w-0 flex-1">
							<span class="block font-semibold">{environmentKind(environment.kind).label}</span>
							<span class="block truncate text-[0.88rem] text-muted">
								{environment.current_version ? `Version ${environment.current_version}` : 'No version recorded'}
								{#if environment.url}
									· <a href={environment.url} target="_blank" rel="noreferrer" class="link">
										{environment.url.replace(/^https?:\/\//, '')}
									</a>
								{/if}
							</span>
						</span>
						<Badge option={environmentStatus(environment.status)} />
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<section class="panel">
		<header class="panel-header">
			<h2 class="panel-title">Quality</h2>
			<a href="{base}/tests" class="btn btn-ghost btn-sm">Open tests <ArrowRight size={16} /></a>
		</header>
		<div class="panel-body grid grid-cols-3 gap-3">
			<div class="rounded-block bg-surface-2 p-4">
				<p class="eyebrow">Passing</p>
				<p class="mt-2 text-3xl font-bold text-ok tabular-nums">{data.testCounts.pass}</p>
			</div>
			<div class="rounded-block bg-surface-2 p-4">
				<p class="eyebrow">Failing</p>
				<p class="mt-2 text-3xl font-bold tabular-nums {data.testCounts.fail > 0 ? 'text-bad' : ''}">
					{data.testCounts.fail}
				</p>
			</div>
			<div class="rounded-block bg-surface-2 p-4">
				<p class="eyebrow">Not run</p>
				<p class="mt-2 text-3xl font-bold tabular-nums">{data.testCounts.pending}</p>
			</div>
		</div>
	</section>

	<section>
		<h2 class="mb-5 text-2xl">Open incidents</h2>
		{#if data.incidents.length === 0}
			<EmptyState title="No open incidents" message="Problems reported for this project will show up here." />
		{:else}
			<div class="list">
				{#each data.incidents as incident (incident.id)}
					<a href="{base}/incidents" class="list-row">
						<span class="min-w-0 flex-1">
							<span class="block truncate font-semibold">{incident.title}</span>
							<span class="block text-[0.88rem] text-muted"><Time value={incident.created_at} relative /></span>
						</span>
						<Badge option={incidentSeverity(incident.severity)} />
					</a>
				{/each}
			</div>
		{/if}
	</section>

	<section>
		<div class="mb-5 flex items-center justify-between gap-4">
			<h2 class="text-2xl">Recent activity</h2>
			<a href="{base}/activity" class="btn btn-ghost btn-sm">See all <ArrowRight size={16} /></a>
		</div>
		{#if data.activity.length === 0}
			<EmptyState title="No activity yet" message="Changes made in this project will show up here." />
		{:else}
			<div class="list">
				{#each data.activity as entry (entry.id)}
					<div class="list-row">
						<span class="min-w-0 flex-1">
							<span class="line-clamp-1 font-medium">{entry.action}</span>
							<span class="block text-[0.88rem] text-muted">
								{entry.actor} · <Time value={entry.created_at} relative />
							</span>
						</span>
					</div>
				{/each}
			</div>
		{/if}
	</section>
</div>

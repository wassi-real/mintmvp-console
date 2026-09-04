<script lang="ts">
	import { untrack } from 'svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import ViewToggle from '$lib/components/ViewToggle.svelte';
	import { liveRefresh, OVERVIEW_TABLES } from '$lib/realtime';
	import { persistViewMode, type ViewMode } from '$lib/view-mode';
	import {
		Activity,
		AlertTriangle,
		ArrowRight,
		FlaskConical,
		FolderKanban,
		ListTodo,
		Plus,
		Rocket
	} from 'lucide-svelte';

	let { data } = $props();

	// Seeded from the cookie the server rendered with; the user owns it from then on.
	let view = $state<ViewMode>(untrack(() => data.viewMode));

	function setView(next: ViewMode) {
		view = next;
		persistViewMode(next);
	}

	$effect(() => liveRefresh(OVERVIEW_TABLES));

	function timeAgo(dateStr: string | null | undefined): string {
		if (!dateStr) return 'Never';
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'Just now';
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.floor(hours / 24)}d ago`;
	}

	/** Cap the stagger so a long list never feels slow to appear. */
	function delay(i: number) {
		return `${Math.min(i, 8) * 40}ms`;
	}

	const totals = $derived(data.totals);
	const testsLabel = $derived(
		totals.testsTotal === 0 ? '--' : `${totals.testsPassing}/${totals.testsTotal}`
	);
</script>

<svelte:head>
	<title>Dashboard Â· MintMVP Console</title>
</svelte:head>

<div class="scroll-area flex min-h-0 flex-1 flex-col overflow-y-auto">
	<div class="mx-auto w-full max-w-[1600px] px-4 pb-10 sm:px-6 lg:px-8">
		<!-- Sticky header -->
		<div
			class="sticky top-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-background/85 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
		>
			<div class="min-w-0">
				<h1 class="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Dashboard</h1>
				<p class="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
					<span class="live-dot" aria-hidden="true"></span>
					Live project health
				</p>
			</div>

			<div class="flex items-center gap-2">
				<ViewToggle mode={view} onChange={setView} />
				<a
					href="/projects"
					class="press flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
				>
					<Plus size={18} />
					<span class="hidden sm:inline">New Project</span>
					<span class="sm:hidden">New</span>
				</a>
			</div>
		</div>

		{#if data.projectSummaries.length === 0}
			<div class="mt-16 flex flex-col items-center justify-center text-center">
				<div class="rise rounded-2xl border border-border bg-card p-10 sm:p-12">
					<Rocket size={48} class="mx-auto mb-4 text-muted-foreground" />
					<h2 class="text-2xl font-bold text-foreground">No projects yet</h2>
					<p class="mt-2 text-base text-muted-foreground">
						Create your first project to start tracking it here.
					</p>
					<a
						href="/projects"
						class="press mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90"
					>
						<Plus size={20} />
						Create a Project
					</a>
				</div>
			</div>
		{:else}
			<!-- Portfolio totals -->
			<div class="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
				{#each [{ label: 'Projects', value: `${totals.activeProjects}/${totals.projects}`, hint: 'active', icon: FolderKanban, tone: 'text-foreground' }, { label: 'Active Tasks', value: totals.tasksInProgress, hint: 'in progress', icon: ListTodo, tone: 'text-foreground' }, { label: 'Tests Passing', value: testsLabel, hint: 'across projects', icon: FlaskConical, tone: totals.testsTotal > 0 && totals.testsPassing === totals.testsTotal ? 'text-success' : 'text-warning' }, { label: 'Open Incidents', value: totals.openIncidents, hint: 'need attention', icon: AlertTriangle, tone: totals.openIncidents > 0 ? 'text-destructive' : 'text-success' }] as stat, i (stat.label)}
					{@const Icon = stat.icon}
					<div
						class="rise card-hover rounded-xl border border-border bg-card p-4 sm:p-5"
						style:--delay={delay(i)}
					>
						<div class="flex items-center justify-between gap-2">
							<p class="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
								{stat.label}
							</p>
							<Icon size={18} class="shrink-0 text-muted-foreground" />
						</div>
						<p class="mt-2 text-2xl font-bold tabular-nums sm:text-3xl {stat.tone}">{stat.value}</p>
						<p class="mt-0.5 text-xs text-muted-foreground">{stat.hint}</p>
					</div>
				{/each}
			</div>

			{#if view === 'grid'}
				<div class="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
					{#each data.projectSummaries as project, i (project.id)}
						{@const done =
							project.totalTasks > 0 ? Math.round((project.tasksDone / project.totalTasks) * 100) : 0}
						<a
							href="/projects/{project.id}"
							class="rise card-hover group flex flex-col rounded-2xl border border-border bg-card p-5"
							style:--delay={delay(i)}
						>
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0">
									<h2 class="truncate text-lg font-bold text-foreground">{project.name}</h2>
									<p class="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
										<Rocket size={13} />
										{timeAgo(project.lastDeploy?.created_at)}
									</p>
								</div>
								<div class="flex shrink-0 items-center gap-2">
									<StatusBadge status={project.status} size="sm" />
									<ArrowRight
										size={18}
										class="text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground"
									/>
								</div>
							</div>

							<div class="mt-4 grid grid-cols-4 gap-2">
								<div class="rounded-lg bg-secondary/50 px-2 py-2 text-center">
									<p class="text-lg font-bold tabular-nums text-foreground">
										{project.tasksInProgress}
									</p>
									<p class="text-[11px] text-muted-foreground">Active</p>
								</div>
								<div class="rounded-lg bg-secondary/50 px-2 py-2 text-center">
									<p class="text-lg font-bold tabular-nums text-foreground">
										{project.tasksInTesting}
									</p>
									<p class="text-[11px] text-muted-foreground">Testing</p>
								</div>
								<div class="rounded-lg bg-secondary/50 px-2 py-2 text-center">
									<p
										class="text-lg font-bold tabular-nums {project.testsPassing
											? 'text-success'
											: 'text-warning'}"
									>
										{project.testsPassCount}/{project.testsTotal}
									</p>
									<p class="text-[11px] text-muted-foreground">Tests</p>
								</div>
								<div class="rounded-lg bg-secondary/50 px-2 py-2 text-center">
									<p
										class="text-lg font-bold tabular-nums {project.openIncidents > 0
											? 'text-destructive'
											: 'text-success'}"
									>
										{project.openIncidents}
									</p>
									<p class="text-[11px] text-muted-foreground">Issues</p>
								</div>
							</div>

							<div class="mt-4">
								<div class="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
									<span>Delivery</span>
									<span class="tabular-nums">{done}%</span>
								</div>
								<div class="h-1.5 overflow-hidden rounded-full bg-secondary">
									<div
										class="h-full rounded-full bg-success transition-[width] duration-500 ease-out motion-reduce:transition-none"
										style:width="{done}%"
									></div>
								</div>
							</div>
						</a>
					{/each}
				</div>
			{:else}
				<div class="mt-6 overflow-hidden rounded-xl border border-border">
					<div
						class="hidden border-b border-border bg-secondary/40 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid lg:grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))] lg:gap-4"
					>
						<span>Project</span>
						<span class="text-center">Active</span>
						<span class="text-center">Testing</span>
						<span class="text-center">Tests</span>
						<span class="text-center">Issues</span>
						<span class="text-right">Last deploy</span>
					</div>

					{#each data.projectSummaries as project, i (project.id)}
						<a
							href="/projects/{project.id}"
							class="rise row-hover group grid grid-cols-1 gap-3 border-b border-border/60 px-5 py-4 last:border-b-0 lg:grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))] lg:items-center lg:gap-4"
							style:--delay={delay(i)}
						>
							<div class="flex min-w-0 items-center gap-3">
								<span class="truncate text-base font-semibold text-foreground">{project.name}</span>
								<StatusBadge status={project.status} size="sm" />
							</div>

							<div class="flex items-center gap-4 text-sm lg:contents">
								<span class="tabular-nums text-foreground lg:text-center">
									<span class="text-muted-foreground lg:hidden">Active: </span>{project.tasksInProgress}
								</span>
								<span class="tabular-nums text-foreground lg:text-center">
									<span class="text-muted-foreground lg:hidden">Testing: </span>{project.tasksInTesting}
								</span>
								<span
									class="tabular-nums lg:text-center {project.testsPassing
										? 'text-success'
										: 'text-warning'}"
								>
									<span class="text-muted-foreground lg:hidden">Tests: </span>{project.testsPassCount}/{project.testsTotal}
								</span>
								<span
									class="tabular-nums lg:text-center {project.openIncidents > 0
										? 'text-destructive'
										: 'text-success'}"
								>
									<span class="text-muted-foreground lg:hidden">Issues: </span>{project.openIncidents}
								</span>
								<span
									class="flex items-center gap-1.5 text-muted-foreground lg:justify-end lg:text-right"
								>
									{timeAgo(project.lastDeploy?.created_at)}
									<ArrowRight
										size={16}
										class="hidden transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground lg:block"
									/>
								</span>
							</div>
						</a>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</div>

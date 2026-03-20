<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import StatCard from '$lib/components/StatCard.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import {
		ListTodo,
		FlaskConical,
		Rocket,
		AlertTriangle,
		Activity,
		ArrowRight,
		Plus
	} from 'lucide-svelte';

	let { data } = $props();

	function timeAgo(dateStr: string | null): string {
		if (!dateStr) return 'Never';
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	}
</script>

<div class="p-4 sm:p-6 lg:p-8">
	<PageHeader title="Dashboard" description="Project health at a glance">
		{#snippet actions()}
			<a
				href="/projects"
				class="flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
			>
				<Plus size={20} />
				New Project
			</a>
		{/snippet}
	</PageHeader>

	{#if data.projectSummaries.length === 0}
		<div class="mt-16 flex flex-col items-center justify-center text-center">
			<div class="rounded-2xl border border-border bg-card p-12">
				<Rocket size={52} class="mx-auto mb-4 text-muted-foreground" />
				<h2 class="text-2xl font-bold text-foreground">No projects yet</h2>
				<p class="mt-2 text-lg text-muted-foreground">
					Create your first project to start tracking it here.
				</p>
				<a
					href="/projects"
					class="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90"
				>
					<Plus size={20} />
					Create a Project
				</a>
			</div>
		</div>
	{:else}
		<div class="mt-8 space-y-8">
			{#each data.projectSummaries as project}
				<div class="rounded-2xl border border-border bg-card p-6">
					<div class="mb-6 flex items-center justify-between">
						<div class="flex items-center gap-4">
							<h2 class="text-2xl font-bold text-foreground">{project.name}</h2>
							<StatusBadge status={project.status} />
						</div>
						<a
							href="/projects/{project.id}"
							class="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-base font-medium text-foreground transition-colors hover:bg-accent"
						>
							View Project
							<ArrowRight size={18} />
						</a>
					</div>

					<div class="grid grid-cols-2 gap-4 lg:grid-cols-5">
						<StatCard label="Active Tasks" value={project.tasksInProgress} icon={ListTodo} />
						<StatCard label="In Testing" value={project.tasksInTesting} icon={Activity} />
						<StatCard
							label="Last Deploy"
							value={timeAgo(project.lastDeploy?.created_at)}
							icon={Rocket}
						/>
						<StatCard
							label="Tests"
							value="{project.testsPassCount}/{project.testsTotal}"
							icon={FlaskConical}
							variant={project.testsPassing ? 'success' : 'warning'}
						/>
						<StatCard
							label="Open Incidents"
							value={project.openIncidents}
							icon={AlertTriangle}
							variant={project.openIncidents > 0 ? 'destructive' : 'success'}
						/>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

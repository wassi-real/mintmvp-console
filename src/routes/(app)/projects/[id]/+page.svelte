<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import StatCard from '$lib/components/StatCard.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import {
		FileText,
		ListTodo,
		FlaskConical,
		Rocket,
		AlertTriangle,
		Activity,
		ExternalLink
	} from 'lucide-svelte';

	let { data } = $props();

	function timeAgo(dateStr: string): string {
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	}
</script>

<div>
	<div class="flex items-center gap-4">
		<PageHeader title={data.project.name} />
		<StatusBadge status={data.project.status} />
	</div>

	{#if data.project.staging_url || data.project.production_url}
		<div class="mt-3 flex gap-4">
			{#if data.project.staging_url}
				<a
					href={data.project.staging_url}
					target="_blank"
					rel="noopener"
					class="inline-flex items-center gap-2 text-base text-muted-foreground hover:text-foreground"
				>
					<ExternalLink size={16} />
					Staging
				</a>
			{/if}
			{#if data.project.production_url}
				<a
					href={data.project.production_url}
					target="_blank"
					rel="noopener"
					class="inline-flex items-center gap-2 text-base text-muted-foreground hover:text-foreground"
				>
					<ExternalLink size={16} />
					Production
				</a>
			{/if}
		</div>
	{/if}

	<div class="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
		<StatCard label="Specs" value={data.stats.specs} icon={FileText} />
		<StatCard label="Tasks in Progress" value={data.stats.tasksInProgress} icon={ListTodo} />
		<StatCard
			label="Tests Passing"
			value="{data.stats.testsPassing}/{data.stats.testsTotal}"
			icon={FlaskConical}
			variant={data.stats.testsFailing === 0 && data.stats.testsTotal > 0 ? 'success' : 'warning'}
		/>
		<StatCard
			label="Open Incidents"
			value={data.stats.openIncidents}
			icon={AlertTriangle}
			variant={data.stats.openIncidents > 0 ? 'destructive' : 'success'}
		/>
	</div>

	<!-- Recent Deployments -->
	<div class="mt-8">
		<h3 class="mb-4 text-xl font-semibold text-foreground">Recent Deployments</h3>
		{#if data.recentDeploys.length === 0}
			<p class="text-muted-foreground">No deployments yet.</p>
		{:else}
			<div class="space-y-3">
				{#each data.recentDeploys as deploy}
					<div
						class="flex items-center justify-between rounded-xl border border-border bg-card/50 px-5 py-4"
					>
						<div class="flex items-center gap-4">
							<Rocket size={20} class="text-muted-foreground" />
							<span class="text-lg font-semibold text-foreground">{deploy.version}</span>
							<StatusBadge status={deploy.environment} size="sm" />
							<StatusBadge status={deploy.status} size="sm" />
						</div>
						<span class="text-base text-muted-foreground">{timeAgo(deploy.created_at)}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Recent Activity -->
	<div class="mt-8">
		<h3 class="mb-4 text-xl font-semibold text-foreground">Recent Activity</h3>
		{#if data.recentActivity.length === 0}
			<p class="text-muted-foreground">No activity yet.</p>
		{:else}
			<div class="space-y-3">
				{#each data.recentActivity as entry}
					<div
						class="flex items-center justify-between rounded-xl border border-border bg-card/50 px-5 py-4"
					>
						<div class="flex items-center gap-3">
							<Activity size={18} class="text-muted-foreground" />
							<span class="text-base text-foreground">{entry.action}</span>
							<span class="text-sm text-muted-foreground">by {entry.actor}</span>
						</div>
						<span class="text-sm text-muted-foreground">{timeAgo(entry.created_at)}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

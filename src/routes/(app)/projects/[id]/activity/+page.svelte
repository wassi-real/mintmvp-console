<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { Activity, Clock } from 'lucide-svelte';

	let { data } = $props();

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

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
	<PageHeader title="Activity Log" description="Proof of work" />

	{#if data.activity.length === 0}
		<EmptyState icon={Activity} title="No activity yet" description="Actions will be logged here." />
	{:else}
		<div class="mt-6 space-y-1">
			{#each data.activity as entry}
				<div
					class="flex items-start gap-4 rounded-xl border border-border bg-card px-6 py-5 transition-colors hover:bg-secondary/30"
				>
					<div class="mt-0.5 rounded-full bg-secondary p-2">
						<Activity size={18} class="text-muted-foreground" />
					</div>
					<div class="flex-1">
						<p class="text-lg font-semibold text-foreground">{entry.action}</p>
					<div class="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
						<span class="flex items-center gap-1">
							<Clock size={14} />
							{timeAgo(entry.created_at)}
						</span>
					</div>
					</div>
					<span class="text-sm text-muted-foreground">{formatDate(entry.created_at)}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

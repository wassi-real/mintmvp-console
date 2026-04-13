<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { HeartPulse, AlertTriangle, AlertCircle, CheckCircle, XCircle, Pencil, Loader } from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	function timeAgo(dateStr: string | null): string {
		if (!dateStr) return 'Never';
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.floor(hours / 24)}d ago`;
	}

	const statusConfig: Record<string, { color: string; bg: string; icon: any; label: string }> = {
		up: { color: 'text-green-400', bg: 'bg-green-950/30 border-green-600/50', icon: CheckCircle, label: 'Operational' },
		down: { color: 'text-red-400', bg: 'bg-red-950/30 border-red-600/50', icon: XCircle, label: 'Down' },
		degraded: { color: 'text-amber-400', bg: 'bg-amber-950/30 border-amber-600/50', icon: AlertCircle, label: 'Degraded' },
		unknown: { color: 'text-muted-foreground', bg: 'bg-card border-border', icon: HeartPulse, label: 'Unknown' }
	};

	const cfg = $derived(statusConfig[data.health?.uptime_status ?? 'unknown'] ?? statusConfig.unknown);

	let editOpen = $state(false);
	let editItem = $state<any>(null);
	let editSubmitting = $state(false);
	let editError = $state('');

	function openEdit() {
		editItem = { ...data.health };
		editError = '';
		editOpen = true;
	}
</script>

<div>
	<PageHeader title="System Health" description="Monitoring overview">
		{#snippet actions()}
			<button onclick={openEdit}
				class="flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90">
				<Pencil size={18} /> Update Status
			</button>
		{/snippet}
	</PageHeader>

	<!-- Main health card -->
	{#if data.health}
		{@const StatusIcon = cfg.icon}
		<div class="mt-6 rounded-xl border-2 p-8 {cfg.bg}">
			<div class="flex items-center gap-4">
				<StatusIcon size={48} class={cfg.color} />
				<div>
					<h2 class="text-3xl font-bold {cfg.color}">{cfg.label}</h2>
					<p class="mt-1 text-base text-muted-foreground">Last checked: {timeAgo(data.health.last_check_at)}</p>
				</div>
			</div>
		</div>

		<!-- Metrics grid -->
		<div class="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
			<div class="rounded-xl border border-border bg-card p-6 text-center">
				<p class="text-sm font-medium text-muted-foreground">Uptime Status</p>
				<p class="mt-2 text-2xl font-bold text-foreground capitalize">{data.health.uptime_status}</p>
			</div>
			<div class="rounded-xl border border-border bg-card p-6 text-center">
				<p class="text-sm font-medium text-muted-foreground">Errors</p>
				<p class="mt-2 text-2xl font-bold {data.health.error_count > 0 ? 'text-red-400' : 'text-foreground'}">{data.health.error_count}</p>
			</div>
			<div class="rounded-xl border border-border bg-card p-6 text-center">
				<p class="text-sm font-medium text-muted-foreground">Warnings</p>
				<p class="mt-2 text-2xl font-bold {data.health.warning_count > 0 ? 'text-amber-400' : 'text-foreground'}">{data.health.warning_count}</p>
			</div>
			<div class="rounded-xl border border-border bg-card p-6 text-center">
				<p class="text-sm font-medium text-muted-foreground">Open Incidents</p>
				<p class="mt-2 text-2xl font-bold {data.openIncidents > 0 ? 'text-red-400' : 'text-foreground'}">{data.openIncidents}</p>
			</div>
		</div>
	{/if}
</div>

<Modal bind:open={editOpen} title="Update Health Status">
	{#if editItem}
		<form method="POST" action="?/update" use:enhance={() => { editSubmitting = true; editError = '';
			return async ({ result }) => { editSubmitting = false;
				if (result.type === 'failure') editError = (result.data as any)?.error ?? 'Error';
				else { editOpen = false; await invalidateAll(); }
			};
		}}>
			{#if editError}<div class="mb-4 rounded-lg bg-red-900/30 px-4 py-3 text-base text-red-300">{editError}</div>{/if}
			<input type="hidden" name="id" value={editItem.id} />
			<div class="space-y-4">
				<div>
					<label for="h-status" class="mb-1 block text-base font-medium text-foreground">Uptime Status</label>
					<select id="h-status" name="uptime_status" bind:value={editItem.uptime_status} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground">
						<option value="up">Up</option><option value="degraded">Degraded</option><option value="down">Down</option><option value="unknown">Unknown</option>
					</select>
				</div>
				<div>
					<label for="h-errors" class="mb-1 block text-base font-medium text-foreground">Error Count</label>
					<input id="h-errors" name="error_count" type="number" min="0" bind:value={editItem.error_count} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground" />
				</div>
				<div>
					<label for="h-warnings" class="mb-1 block text-base font-medium text-foreground">Warning Count</label>
					<input id="h-warnings" name="warning_count" type="number" min="0" bind:value={editItem.warning_count} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground" />
				</div>
			</div>
			<div class="mt-6 flex gap-3">
				<button type="submit" disabled={editSubmitting} class="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
					{#if editSubmitting}<Loader size={18} class="animate-spin" />Saving...{:else}Save{/if}
				</button>
				<button type="button" onclick={() => (editOpen = false)} class="rounded-lg bg-secondary px-6 py-3 text-base font-medium text-foreground hover:bg-accent">Cancel</button>
			</div>
		</form>
	{/if}
</Modal>

<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { Globe, Server, Rocket, Pencil, Loader } from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	const kindIcons: Record<string, any> = { development: Globe, staging: Server, production: Rocket };
	const kindLabels: Record<string, string> = { development: 'Development', staging: 'Staging', production: 'Production' };
	const kindColors: Record<string, string> = {
		development: 'border-blue-600/50 bg-blue-950/20',
		staging: 'border-amber-600/50 bg-amber-950/20',
		production: 'border-green-600/50 bg-green-950/20'
	};

	function timeAgo(dateStr: string | null): string {
		if (!dateStr) return 'Never';
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.floor(hours / 24)}d ago`;
	}

	let editOpen = $state(false);
	let editItem = $state<any>(null);
	let editSubmitting = $state(false);
	let editError = $state('');

	function openEdit(env: any) {
		editItem = { ...env };
		editError = '';
		editOpen = true;
	}
</script>

<div>
	<PageHeader title="Environments" description="Development, Staging & Production" />

	<div class="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
		{#each data.environments as env}
			{@const Icon = kindIcons[env.kind] ?? Globe}
			<div class="rounded-xl border-2 p-6 {kindColors[env.kind] ?? 'border-border bg-card'}">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<Icon size={24} class="text-foreground" />
						<h3 class="text-xl font-bold text-foreground">{kindLabels[env.kind] ?? env.kind}</h3>
					</div>
					<button onclick={() => openEdit(env)} class="rounded p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Edit">
						<Pencil size={16} />
					</button>
				</div>

				<div class="mt-5 space-y-3">
					<div>
						<p class="text-sm font-medium text-muted-foreground">URL</p>
						{#if env.url}
							<a href={env.url} target="_blank" rel="noopener noreferrer" class="text-base font-medium text-primary hover:underline break-all">{env.url}</a>
						{:else}
							<p class="text-base text-muted-foreground">--</p>
						{/if}
					</div>
					<div>
						<p class="text-sm font-medium text-muted-foreground">Version</p>
						<p class="text-base font-semibold text-foreground">{env.current_version || '--'}</p>
					</div>
					<div>
						<p class="text-sm font-medium text-muted-foreground">Last Deploy</p>
						<p class="text-base text-foreground">{timeAgo(env.last_deploy_at)}</p>
					</div>
					<div>
						<p class="text-sm font-medium text-muted-foreground">Status</p>
						<StatusBadge status={env.status} />
					</div>
				</div>
			</div>
		{/each}
	</div>
</div>

<Modal bind:open={editOpen} title="Update Environment">
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
					<label for="env-url" class="mb-1 block text-base font-medium text-foreground">URL</label>
					<input id="env-url" name="url" bind:value={editItem.url} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground" placeholder="https://staging.example.com" />
				</div>
				<div>
					<label for="env-ver" class="mb-1 block text-base font-medium text-foreground">Current Version</label>
					<input id="env-ver" name="current_version" bind:value={editItem.current_version} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground" placeholder="v1.0.0" />
				</div>
				<div>
					<label for="env-status" class="mb-1 block text-base font-medium text-foreground">Status</label>
					<select id="env-status" name="status" bind:value={editItem.status} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground">
						<option value="healthy">Healthy</option><option value="broken">Broken</option><option value="unknown">Unknown</option>
					</select>
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

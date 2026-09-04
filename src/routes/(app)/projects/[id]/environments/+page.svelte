<script lang="ts">
	import PageTitleBar from '$lib/components/PageTitleBar.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { Globe, Server, Rocket, Pencil, Loader, ExternalLink, Layers } from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	const kindIcons: Record<string, any> = { development: Globe, staging: Server, production: Rocket };
	const kindLabels: Record<string, string> = {
		development: 'Development',
		staging: 'Staging',
		production: 'Production'
	};

	const statusTone: Record<string, string> = {
		healthy: 'text-success',
		broken: 'text-destructive',
		unknown: 'text-muted-foreground'
	};
	const statusDot: Record<string, string> = {
		healthy: 'bg-success',
		broken: 'bg-destructive',
		unknown: 'bg-muted-foreground'
	};

	const healthyCount = $derived(data.environments.filter((e) => e.status === 'healthy').length);
	const brokenCount = $derived(data.environments.filter((e) => e.status === 'broken').length);
	const versionedCount = $derived(data.environments.filter((e) => Boolean(e.current_version)).length);

	function timeAgo(dateStr: string | null): string {
		if (!dateStr) return 'Never';
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.floor(hours / 24)}d ago`;
	}

	function delay(i: number) {
		return `${Math.min(i, 8) * 40}ms`;
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

<PageTitleBar title="Environments">
	{#snippet meta()}
		{#if brokenCount > 0}
			<span class="font-semibold tabular-nums text-destructive">{brokenCount} broken</span>
		{:else if healthyCount > 0 && healthyCount === data.environments.length}
			<span class="live-dot"></span>
			<span>All environments healthy</span>
		{:else}
			<span class="tabular-nums">{healthyCount} healthy</span>
		{/if}
		<span aria-hidden="true" class="opacity-40">·</span>
		<span class="tabular-nums">{versionedCount}/{data.environments.length} versioned</span>
	{/snippet}
</PageTitleBar>

{#if data.environments.length === 0}
	<EmptyState
		icon={Layers}
		title="No environments"
		description="Development, staging and production entries are created automatically for this project."
	/>
{:else}
	<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
		{#each data.environments as env, i (env.id)}
			{@const Icon = kindIcons[env.kind] ?? Globe}
			<div
				class="rise card-hover rounded-xl border border-border bg-card p-5"
				style:--delay={delay(i)}
			>
				<div class="flex items-start justify-between gap-3">
					<div class="flex min-w-0 items-center gap-2.5">
						<span
							class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary"
						>
							<Icon size={15} class="text-muted-foreground" />
						</span>
						<div class="min-w-0">
							<p class="truncate text-sm font-semibold text-foreground">
								{kindLabels[env.kind] ?? env.kind}
							</p>
							<p
								class="flex items-center gap-1.5 text-xs capitalize {statusTone[env.status] ??
									'text-muted-foreground'}"
							>
								<span
									class="h-1.5 w-1.5 shrink-0 rounded-full {statusDot[env.status] ??
										'bg-muted-foreground'}"
								></span>
								{env.status}
							</p>
						</div>
					</div>
					<button
						onclick={() => openEdit(env)}
						class="press shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
						aria-label="Edit {kindLabels[env.kind] ?? env.kind} environment"
					>
						<Pencil size={15} />
					</button>
				</div>

				<div class="mt-4 space-y-3">
					<div>
						<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">URL</p>
						{#if env.url}
							<a
								href={env.url}
								target="_blank"
								rel="noopener noreferrer"
								class="mt-0.5 inline-flex items-start gap-1 break-all text-sm font-medium text-foreground hover:underline"
							>
								{env.url}
								<ExternalLink size={12} class="mt-1 shrink-0 text-muted-foreground" />
							</a>
						{:else}
							<p class="mt-0.5 text-sm text-muted-foreground">Not set</p>
						{/if}
					</div>

					<div class="grid grid-cols-2 gap-3 border-t border-border/60 pt-3">
						<div class="min-w-0">
							<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
								Version
							</p>
							<p class="mt-0.5 truncate font-mono text-sm font-semibold tabular-nums text-foreground">
								{env.current_version || '--'}
							</p>
						</div>
						<div class="min-w-0">
							<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
								Last deploy
							</p>
							<p class="mt-0.5 truncate text-sm tabular-nums text-foreground">
								{timeAgo(env.last_deploy_at)}
							</p>
						</div>
					</div>
				</div>
			</div>
		{/each}
	</div>
{/if}

<Modal bind:open={editOpen} title="Update Environment">
	{#if editItem}
		<form
			method="POST"
			action="?/update"
			use:enhance={() => {
				editSubmitting = true;
				editError = '';
				return async ({ result }) => {
					editSubmitting = false;
					if (result.type === 'failure') editError = (result.data as any)?.error ?? 'Error';
					else {
						editOpen = false;
						await invalidateAll();
					}
				};
			}}
		>
			{#if editError}
				<div
					class="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
				>
					{editError}
				</div>
			{/if}
			<input type="hidden" name="id" value={editItem.id} />
			<div class="space-y-4">
				<div>
					<label
						for="env-url"
						class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
						>URL</label
					>
					<input
						id="env-url"
						name="url"
						bind:value={editItem.url}
						class="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground"
						placeholder="https://staging.example.com"
					/>
				</div>
				<div>
					<label
						for="env-ver"
						class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
						>Current version</label
					>
					<input
						id="env-ver"
						name="current_version"
						bind:value={editItem.current_version}
						class="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 font-mono text-sm text-foreground"
						placeholder="v1.0.0"
					/>
				</div>
				<div>
					<label
						for="env-status"
						class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
						>Status</label
					>
					<select
						id="env-status"
						name="status"
						bind:value={editItem.status}
						class="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground"
					>
						<option value="healthy">Healthy</option><option value="broken">Broken</option><option
							value="unknown">Unknown</option
						>
					</select>
				</div>
			</div>
			<div class="mt-6 flex gap-2">
				<button
					type="submit"
					disabled={editSubmitting}
					class="press inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
				>
					{#if editSubmitting}<Loader size={15} class="animate-spin" />Saving...{:else}Save{/if}
				</button>
				<button
					type="button"
					onclick={() => (editOpen = false)}
					class="press rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
					>Cancel</button
				>
			</div>
		</form>
	{/if}
</Modal>

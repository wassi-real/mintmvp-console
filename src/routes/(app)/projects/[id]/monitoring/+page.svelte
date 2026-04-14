<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { HeartPulse, AlertTriangle, AlertCircle, CheckCircle, XCircle, Pencil, Loader, Globe, Copy, Link2 } from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data, form } = $props();

	let publishSubmitting = $state(false);
	let unpublishSubmitting = $state(false);
	let rotateSubmitting = $state(false);
	let copyHint = $state('');

	const formPublicUrl = $derived(
		form && typeof (form as { publicUrl?: string }).publicUrl === 'string'
			? (form as { publicUrl: string }).publicUrl
			: null
	);
	const formFlash = $derived(
		form && typeof (form as { alreadyLive?: boolean }).alreadyLive === 'boolean' && (form as { alreadyLive: boolean }).alreadyLive
			? 'This page is already public at the URL below.'
			: form && (form as { unpublished?: boolean }).unpublished === true
				? 'Public access is off. The old link returns 404 until you publish again.'
				: ''
	);
	const formError = $derived(
		form && typeof (form as { error?: string }).error === 'string' ? (form as { error: string }).error : ''
	);

	async function copyText(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copyHint = 'Copied';
			setTimeout(() => (copyHint = ''), 2000);
		} catch {
			copyHint = 'Copy failed';
			setTimeout(() => (copyHint = ''), 2000);
		}
	}

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

	{#if data.canManagePublicMonitoring}
		<div class="mt-8 rounded-xl border border-border bg-card p-6">
			<div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
						<Globe size={20} class="text-muted-foreground" />
					</div>
					<div>
						<h2 class="text-lg font-semibold text-foreground">Public status page</h2>
						<p class="mt-0.5 text-sm text-muted-foreground">
							Anyone with the link can view this project’s monitoring summary (no login). Publishing uses the server
							service role to serve read-only data.
						</p>
					</div>
				</div>
			</div>

			{#if formError}
				<p class="mt-4 rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-300">{formError}</p>
			{/if}
			{#if formFlash}
				<p class="mt-4 rounded-lg border border-border bg-secondary/50 px-4 py-3 text-sm text-foreground">{formFlash}</p>
			{/if}

			{#if data.publicStatusPage?.isEnabled}
				<div class="mt-5 space-y-3">
					<label for="public-monitoring-url" class="block text-xs font-medium uppercase tracking-wide text-muted-foreground"
						>Public URL</label
					>
					<div class="flex flex-col gap-2 sm:flex-row sm:items-center">
						<input
							id="public-monitoring-url"
							readonly
							value={formPublicUrl ?? data.publicStatusPage.url}
							class="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2.5 font-mono text-sm text-foreground"
						/>
						<button
							type="button"
							onclick={() => copyText(formPublicUrl ?? data.publicStatusPage!.url)}
							class="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary/80"
						>
							<Copy size={16} /> Copy
						</button>
					</div>
					{#if copyHint}<p class="text-xs text-muted-foreground">{copyHint}</p>{/if}
					<div class="flex flex-wrap gap-3 pt-2">
						<form
							method="POST"
							action="?/rotatePublicToken"
							use:enhance={() => {
								rotateSubmitting = true;
								return async ({ update }) => {
									await update();
									rotateSubmitting = false;
									await invalidateAll();
								};
							}}
						>
							<button
								type="submit"
								disabled={rotateSubmitting}
								class="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary disabled:opacity-50"
							>
								<Link2 size={16} /> New secret link
							</button>
						</form>
						<form
							method="POST"
							action="?/unpublishPublic"
							use:enhance={() => {
								unpublishSubmitting = true;
								return async ({ update }) => {
									await update();
									unpublishSubmitting = false;
									await invalidateAll();
								};
							}}
						>
							<button
								type="submit"
								disabled={unpublishSubmitting}
								class="inline-flex items-center gap-2 rounded-lg bg-red-900/25 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-900/40 disabled:opacity-50"
							>
								Stop publishing
							</button>
						</form>
					</div>
				</div>
			{:else if data.publicStatusPage && !data.publicStatusPage.isEnabled}
				<p class="mt-4 text-sm text-muted-foreground">
					Publishing is paused. The previous link returns 404 until you publish again (same URL will work).
				</p>
				<form
					method="POST"
					action="?/publishPublic"
					class="mt-4"
					use:enhance={() => {
						publishSubmitting = true;
						return async ({ update }) => {
							await update();
							publishSubmitting = false;
							await invalidateAll();
						};
					}}
				>
					<button
						type="submit"
						disabled={publishSubmitting}
						class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
					>
						<Globe size={16} /> Publish again
					</button>
				</form>
			{:else}
				<form
					method="POST"
					action="?/publishPublic"
					class="mt-5"
					use:enhance={() => {
						publishSubmitting = true;
						return async ({ update }) => {
							await update();
							publishSubmitting = false;
							await invalidateAll();
						};
					}}
				>
					<button
						type="submit"
						disabled={publishSubmitting}
						class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
					>
						{#if publishSubmitting}
							<Loader size={16} class="animate-spin" /> Deploying…
						{:else}
							<Globe size={16} /> Deploy public status page
						{/if}
					</button>
				</form>
			{/if}
		</div>
	{/if}

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

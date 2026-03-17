<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { AlertTriangle, Plus, Loader, Pencil, Trash2 } from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	const openCount = $derived(data.incidents.filter((i: any) => i.status !== 'resolved').length);

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '--';
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
		});
	}

	// create
	let createOpen = $state(false);
	let createSubmitting = $state(false);
	let createError = $state('');

	// edit
	let editOpen = $state(false);
	let editItem = $state<any>(null);
	let editSubmitting = $state(false);
	let editError = $state('');

	function openEdit(i: any) { editItem = { ...i }; editError = ''; editOpen = true; }

	// delete
	let deleteOpen = $state(false);
	let deleteItem = $state<any>(null);
	let deleteSubmitting = $state(false);

	function openDelete(i: any) { deleteItem = i; deleteOpen = true; }
</script>

<div>
	<PageHeader title="Incidents" description="{openCount} open">
		{#snippet actions()}
			<button onclick={() => { createError = ''; createOpen = true; }}
				class="flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90">
				<Plus size={20} /> Report Incident
			</button>
		{/snippet}
	</PageHeader>

	<!-- Create -->
	<Modal bind:open={createOpen} title="Report Incident">
		<form method="POST" action="?/create" use:enhance={() => { createSubmitting = true; createError = '';
			return async ({ result }) => { createSubmitting = false;
				if (result.type === 'failure') createError = (result.data as any)?.error ?? 'Error';
				else { createOpen = false; await invalidateAll(); }
			};
		}}>
			{#if createError}<div class="mb-4 rounded-lg bg-red-900/30 px-4 py-3 text-base text-red-300">{createError}</div>{/if}
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div class="sm:col-span-2">
					<label for="c-title" class="mb-1 block text-base font-medium text-foreground">Title <span class="text-destructive">*</span></label>
					<input id="c-title" name="title" required class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground" placeholder="Score not updating" />
				</div>
				<div>
					<label for="c-severity" class="mb-1 block text-base font-medium text-foreground">Severity</label>
					<select id="c-severity" name="severity" class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground">
						<option value="low">Low</option><option value="medium" selected>Medium</option>
						<option value="high">High</option><option value="critical">Critical</option>
					</select>
				</div>
				<div>
					<label for="c-status" class="mb-1 block text-base font-medium text-foreground">Status</label>
					<select id="c-status" name="status" class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground">
						<option value="open" selected>Open</option><option value="investigating">Investigating</option><option value="resolved">Resolved</option>
					</select>
				</div>
				<div class="sm:col-span-2">
					<label for="c-desc" class="mb-1 block text-base font-medium text-foreground">Description</label>
					<textarea id="c-desc" name="description" rows="3" class="w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground" placeholder="Describe the issue..."></textarea>
				</div>
			</div>
			<div class="mt-6 flex gap-3">
				<button type="submit" disabled={createSubmitting} class="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
					{#if createSubmitting}<Loader size={18} class="animate-spin" />Reporting...{:else}Report Incident{/if}
				</button>
				<button type="button" onclick={() => (createOpen = false)} class="rounded-lg bg-secondary px-6 py-3 text-base font-medium text-foreground hover:bg-accent">Cancel</button>
			</div>
		</form>
	</Modal>

	<!-- Edit -->
	<Modal bind:open={editOpen} title="Edit Incident">
		{#if editItem}
			<form method="POST" action="?/update" use:enhance={() => { editSubmitting = true; editError = '';
				return async ({ result }) => { editSubmitting = false;
					if (result.type === 'failure') editError = (result.data as any)?.error ?? 'Error';
					else { editOpen = false; await invalidateAll(); }
				};
			}}>
				{#if editError}<div class="mb-4 rounded-lg bg-red-900/30 px-4 py-3 text-base text-red-300">{editError}</div>{/if}
				<input type="hidden" name="id" value={editItem.id} />
				<input type="hidden" name="wasResolved" value={String(editItem.status === 'resolved')} />
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div class="sm:col-span-2">
						<label for="e-title" class="mb-1 block text-base font-medium text-foreground">Title <span class="text-destructive">*</span></label>
						<input id="e-title" name="title" required bind:value={editItem.title} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground" />
					</div>
					<div>
						<label for="e-severity" class="mb-1 block text-base font-medium text-foreground">Severity</label>
						<select id="e-severity" name="severity" bind:value={editItem.severity} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground">
							<option value="low">Low</option><option value="medium">Medium</option>
							<option value="high">High</option><option value="critical">Critical</option>
						</select>
					</div>
					<div>
						<label for="e-status" class="mb-1 block text-base font-medium text-foreground">Status</label>
						<select id="e-status" name="status" bind:value={editItem.status} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground">
							<option value="open">Open</option><option value="investigating">Investigating</option><option value="resolved">Resolved</option>
						</select>
					</div>
					<div class="sm:col-span-2">
						<label for="e-desc" class="mb-1 block text-base font-medium text-foreground">Description</label>
						<textarea id="e-desc" name="description" rows="3" bind:value={editItem.description} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground"></textarea>
					</div>
				</div>
				<div class="mt-6 flex gap-3">
					<button type="submit" disabled={editSubmitting} class="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
						{#if editSubmitting}<Loader size={18} class="animate-spin" />Saving...{:else}Save Changes{/if}
					</button>
					<button type="button" onclick={() => (editOpen = false)} class="rounded-lg bg-secondary px-6 py-3 text-base font-medium text-foreground hover:bg-accent">Cancel</button>
				</div>
			</form>
		{/if}
	</Modal>

	<!-- Delete -->
	<Modal bind:open={deleteOpen} title="Delete Incident">
		{#if deleteItem}
			<p class="text-lg text-foreground">Delete incident <strong>{deleteItem.title}</strong>?</p>
			<p class="mt-1 text-base text-muted-foreground">This cannot be undone.</p>
			<form method="POST" action="?/delete" use:enhance={() => { deleteSubmitting = true;
				return async ({ result }) => { deleteSubmitting = false;
					if (result.type !== 'failure') { deleteOpen = false; await invalidateAll(); }
				};
			}}>
				<input type="hidden" name="id" value={deleteItem.id} />
				<input type="hidden" name="title" value={deleteItem.title} />
				<div class="mt-6 flex gap-3">
					<button type="submit" disabled={deleteSubmitting} class="flex items-center gap-2 rounded-lg bg-destructive px-6 py-3 text-base font-semibold text-white hover:bg-destructive/90 disabled:opacity-60">
						{#if deleteSubmitting}<Loader size={18} class="animate-spin" />Deleting...{:else}<Trash2 size={18} />Delete{/if}
					</button>
					<button type="button" onclick={() => (deleteOpen = false)} class="rounded-lg bg-secondary px-6 py-3 text-base font-medium text-foreground hover:bg-accent">Cancel</button>
				</div>
			</form>
		{/if}
	</Modal>

	{#if data.incidents.length === 0}
		<EmptyState icon={AlertTriangle} title="No incidents" description="No bugs or issues reported." />
	{:else}
		<div class="mt-6 overflow-hidden rounded-xl border border-border">
			<table class="w-full text-left">
				<thead class="border-b border-border bg-secondary/50">
					<tr>
						<th class="px-6 py-4 text-base font-semibold text-foreground">Title</th>
						<th class="px-6 py-4 text-base font-semibold text-foreground">Severity</th>
						<th class="px-6 py-4 text-base font-semibold text-foreground">Status</th>
						<th class="px-6 py-4 text-base font-semibold text-foreground">Created</th>
						<th class="px-6 py-4 text-base font-semibold text-foreground">Resolved</th>
						<th class="px-6 py-4 text-base font-semibold text-foreground"></th>
					</tr>
				</thead>
				<tbody>
					{#each data.incidents as incident}
						<tr class="group border-b border-border transition-colors hover:bg-secondary/30">
							<td class="px-6 py-4">
								<p class="text-lg font-semibold text-foreground">{incident.title}</p>
								{#if incident.description}
									<p class="mt-1 text-sm text-muted-foreground">{incident.description}</p>
								{/if}
							</td>
							<td class="px-6 py-4"><StatusBadge status={incident.severity} /></td>
							<td class="px-6 py-4"><StatusBadge status={incident.status} /></td>
							<td class="px-6 py-4 text-base text-muted-foreground">{formatDate(incident.created_at)}</td>
							<td class="px-6 py-4 text-base text-muted-foreground">{formatDate(incident.resolved_at)}</td>
							<td class="px-6 py-4">
								<div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
									<button onclick={() => openEdit(incident)} class="rounded p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Edit"><Pencil size={16} /></button>
									<button onclick={() => openDelete(incident)} class="rounded p-2 text-muted-foreground hover:bg-red-900/40 hover:text-red-300" aria-label="Delete"><Trash2 size={16} /></button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

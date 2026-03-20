<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { Rocket, Plus, Loader, Pencil, Trash2 } from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	function formatDate(dateStr: string): string {
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
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

	function openEdit(d: any) { editItem = { ...d }; editError = ''; editOpen = true; }

	// delete
	let deleteOpen = $state(false);
	let deleteItem = $state<any>(null);
	let deleteSubmitting = $state(false);

	function openDelete(d: any) { deleteItem = d; deleteOpen = true; }
</script>

<div>
	<PageHeader title="Deployments" description="Deploy history">
		{#snippet actions()}
			<button onclick={() => { createError = ''; createOpen = true; }}
				class="flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90">
				<Plus size={20} /> Log Deploy
			</button>
		{/snippet}
	</PageHeader>

	<!-- Create -->
	<Modal bind:open={createOpen} title="Log Deployment">
		<form method="POST" action="?/create" use:enhance={() => { createSubmitting = true; createError = '';
			return async ({ result }) => { createSubmitting = false;
				if (result.type === 'failure') createError = (result.data as any)?.error ?? 'Error';
				else { createOpen = false; await invalidateAll(); }
			};
		}}>
			{#if createError}<div class="mb-4 rounded-lg bg-red-900/30 px-4 py-3 text-base text-red-300">{createError}</div>{/if}
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div>
					<label for="c-version" class="mb-1 block text-base font-medium text-foreground">Version <span class="text-destructive">*</span></label>
					<input id="c-version" name="version" required class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground" placeholder="v0.3.0" />
				</div>
				<div>
					<label for="c-env" class="mb-1 block text-base font-medium text-foreground">Environment</label>
					<select id="c-env" name="environment" class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground">
						<option value="staging">Staging</option><option value="production">Production</option>
					</select>
				</div>
				<div>
					<label for="c-status" class="mb-1 block text-base font-medium text-foreground">Status</label>
					<select id="c-status" name="status" class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground">
						<option value="success" selected>Success</option><option value="failed">Failed</option><option value="pending">Pending</option>
					</select>
				</div>
				<div>
					<label for="c-notes" class="mb-1 block text-base font-medium text-foreground">Notes</label>
					<input id="c-notes" name="notes" class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground" placeholder="e.g. Scoring fix" />
				</div>
			</div>
			<div class="mt-6 flex gap-3">
				<button type="submit" disabled={createSubmitting} class="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
					{#if createSubmitting}<Loader size={18} class="animate-spin" />Logging...{:else}Log Deploy{/if}
				</button>
				<button type="button" onclick={() => (createOpen = false)} class="rounded-lg bg-secondary px-6 py-3 text-base font-medium text-foreground hover:bg-accent">Cancel</button>
			</div>
		</form>
	</Modal>

	<!-- Edit -->
	<Modal bind:open={editOpen} title="Edit Deployment">
		{#if editItem}
			<form method="POST" action="?/update" use:enhance={() => { editSubmitting = true; editError = '';
				return async ({ result }) => { editSubmitting = false;
					if (result.type === 'failure') editError = (result.data as any)?.error ?? 'Error';
					else { editOpen = false; await invalidateAll(); }
				};
			}}>
				{#if editError}<div class="mb-4 rounded-lg bg-red-900/30 px-4 py-3 text-base text-red-300">{editError}</div>{/if}
				<input type="hidden" name="id" value={editItem.id} />
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<label for="e-version" class="mb-1 block text-base font-medium text-foreground">Version <span class="text-destructive">*</span></label>
						<input id="e-version" name="version" required bind:value={editItem.version} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground" />
					</div>
					<div>
						<label for="e-env" class="mb-1 block text-base font-medium text-foreground">Environment</label>
						<select id="e-env" name="environment" bind:value={editItem.environment} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground">
							<option value="staging">Staging</option><option value="production">Production</option>
						</select>
					</div>
					<div>
						<label for="e-status" class="mb-1 block text-base font-medium text-foreground">Status</label>
						<select id="e-status" name="status" bind:value={editItem.status} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground">
							<option value="success">Success</option><option value="failed">Failed</option><option value="pending">Pending</option>
						</select>
					</div>
					<div>
						<label for="e-notes" class="mb-1 block text-base font-medium text-foreground">Notes</label>
						<input id="e-notes" name="notes" bind:value={editItem.notes} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground" />
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
	<Modal bind:open={deleteOpen} title="Delete Deployment">
		{#if deleteItem}
			<p class="text-lg text-foreground">Delete deployment <strong>{deleteItem.version}</strong>?</p>
			<p class="mt-1 text-base text-muted-foreground">This cannot be undone.</p>
			<form method="POST" action="?/delete" use:enhance={() => { deleteSubmitting = true;
				return async ({ result }) => { deleteSubmitting = false;
					if (result.type !== 'failure') { deleteOpen = false; await invalidateAll(); }
				};
			}}>
				<input type="hidden" name="id" value={deleteItem.id} />
				<input type="hidden" name="version" value={deleteItem.version} />
				<div class="mt-6 flex gap-3">
					<button type="submit" disabled={deleteSubmitting} class="flex items-center gap-2 rounded-lg bg-destructive px-6 py-3 text-base font-semibold text-white hover:bg-destructive/90 disabled:opacity-60">
						{#if deleteSubmitting}<Loader size={18} class="animate-spin" />Deleting...{:else}<Trash2 size={18} />Delete{/if}
					</button>
					<button type="button" onclick={() => (deleteOpen = false)} class="rounded-lg bg-secondary px-6 py-3 text-base font-medium text-foreground hover:bg-accent">Cancel</button>
				</div>
			</form>
		{/if}
	</Modal>

	{#if data.deployments.length === 0}
		<EmptyState icon={Rocket} title="No deployments yet" description="Log your first deployment." />
	{:else}
		<div class="mt-6 overflow-hidden rounded-xl border border-border">
			<table class="w-full text-left">
				<thead class="border-b border-border bg-secondary/50">
					<tr>
						<th class="px-6 py-4 text-base font-semibold text-foreground">Version</th>
						<th class="px-6 py-4 text-base font-semibold text-foreground">Environment</th>
						<th class="px-6 py-4 text-base font-semibold text-foreground">Status</th>
						<th class="px-6 py-4 text-base font-semibold text-foreground">Notes</th>
						<th class="px-6 py-4 text-base font-semibold text-foreground">Date</th>
						<th class="px-6 py-4 text-base font-semibold text-foreground"></th>
					</tr>
				</thead>
				<tbody>
					{#each data.deployments as deploy}
						<tr class="group border-b border-border transition-colors hover:bg-secondary/30">
							<td class="px-6 py-4 text-lg font-bold text-foreground">{deploy.version}</td>
							<td class="px-6 py-4"><StatusBadge status={deploy.environment} /></td>
							<td class="px-6 py-4"><StatusBadge status={deploy.status} /></td>
							<td class="px-6 py-4 text-base text-muted-foreground">{deploy.notes ?? '--'}</td>
							<td class="px-6 py-4 text-base text-muted-foreground">{formatDate(deploy.created_at)}</td>
							<td class="px-6 py-4">
								<div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
									<button onclick={() => openEdit(deploy)} class="rounded p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Edit"><Pencil size={16} /></button>
									<button onclick={() => openDelete(deploy)} class="rounded p-2 text-muted-foreground hover:bg-red-900/40 hover:text-red-300" aria-label="Delete"><Trash2 size={16} /></button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { FlaskConical, Plus, Loader, Pencil, Trash2 } from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	const passCount = $derived(data.tests.filter((t: any) => t.status === 'pass').length);
	const failCount = $derived(data.tests.filter((t: any) => t.status === 'fail').length);

	function timeAgo(dateStr: string | null): string {
		if (!dateStr) return 'Never';
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.floor(hours / 24)}d ago`;
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

	function openEdit(t: any) { editItem = { ...t }; editError = ''; editOpen = true; }

	// delete
	let deleteOpen = $state(false);
	let deleteItem = $state<any>(null);
	let deleteSubmitting = $state(false);

	function openDelete(t: any) { deleteItem = t; deleteOpen = true; }

	function specName(specId: string | null) {
		if (!specId) return '';
		return data.specs.find((s: any) => s.id === specId)?.title ?? specId.slice(0, 8);
	}
	function taskNameOf(taskId: string | null) {
		if (!taskId) return '';
		return data.tasks.find((t: any) => t.id === taskId)?.title ?? taskId.slice(0, 8);
	}
</script>

<div>
	<PageHeader title="Test Center" description="{passCount} passing, {failCount} failing">
		{#snippet actions()}
			<button onclick={() => { createError = ''; createOpen = true; }}
				class="flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90">
				<Plus size={20} /> Add Test
			</button>
		{/snippet}
	</PageHeader>

	<!-- Create -->
	<Modal bind:open={createOpen} title="Add Test">
		<form method="POST" action="?/create" use:enhance={() => { createSubmitting = true; createError = '';
			return async ({ result }) => { createSubmitting = false;
				if (result.type === 'failure') createError = (result.data as any)?.error ?? 'Error';
				else { createOpen = false; await invalidateAll(); }
			};
		}}>
			{#if createError}<div class="mb-4 rounded-lg bg-red-900/30 px-4 py-3 text-base text-red-300">{createError}</div>{/if}
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div class="sm:col-span-2">
					<label for="c-name" class="mb-1 block text-base font-medium text-foreground">Test Name <span class="text-destructive">*</span></label>
					<input id="c-name" name="name" required class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground" placeholder="Signup flow test" />
				</div>
				<div>
					<label for="c-type" class="mb-1 block text-base font-medium text-foreground">Type</label>
					<select id="c-type" name="type" class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground">
						<option value="unit">Unit</option><option value="integration">Integration</option>
						<option value="e2e">E2E</option><option value="smoke">Smoke</option><option value="manual" selected>Manual</option>
					</select>
				</div>
				<div>
					<label for="c-status" class="mb-1 block text-base font-medium text-foreground">Status</label>
					<select id="c-status" name="status" class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground">
						<option value="pending" selected>Pending</option><option value="pass">Pass</option><option value="fail">Fail</option>
					</select>
				</div>
				<div>
					<label for="c-spec" class="mb-1 block text-base font-medium text-foreground">Linked Spec</label>
					<select id="c-spec" name="spec_id" class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground">
						<option value="">None</option>
						{#each data.specs as s}<option value={s.id}>{s.title}</option>{/each}
					</select>
				</div>
				<div>
					<label for="c-task" class="mb-1 block text-base font-medium text-foreground">Linked Task</label>
					<select id="c-task" name="task_id" class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground">
						<option value="">None</option>
						{#each data.tasks as t}<option value={t.id}>{t.title}</option>{/each}
					</select>
				</div>
				<div class="sm:col-span-2">
					<label for="c-notes" class="mb-1 block text-base font-medium text-foreground">Notes</label>
					<textarea id="c-notes" name="notes" rows="2" class="w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground" placeholder="Optional notes..."></textarea>
				</div>
			</div>
			<div class="mt-6 flex gap-3">
				<button type="submit" disabled={createSubmitting} class="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
					{#if createSubmitting}<Loader size={18} class="animate-spin" />Adding...{:else}Add Test{/if}
				</button>
				<button type="button" onclick={() => (createOpen = false)} class="rounded-lg bg-secondary px-6 py-3 text-base font-medium text-foreground hover:bg-accent">Cancel</button>
			</div>
		</form>
	</Modal>

	<!-- Edit -->
	<Modal bind:open={editOpen} title="Edit Test">
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
					<div class="sm:col-span-2">
						<label for="e-name" class="mb-1 block text-base font-medium text-foreground">Test Name <span class="text-destructive">*</span></label>
						<input id="e-name" name="name" required bind:value={editItem.name} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground" />
					</div>
					<div>
						<label for="e-type" class="mb-1 block text-base font-medium text-foreground">Type</label>
						<select id="e-type" name="type" bind:value={editItem.type} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground">
							<option value="unit">Unit</option><option value="integration">Integration</option>
							<option value="e2e">E2E</option><option value="smoke">Smoke</option><option value="manual">Manual</option>
						</select>
					</div>
					<div>
						<label for="e-status" class="mb-1 block text-base font-medium text-foreground">Status</label>
						<select id="e-status" name="status" bind:value={editItem.status} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground">
							<option value="pending">Pending</option><option value="pass">Pass</option><option value="fail">Fail</option>
						</select>
					</div>
					<div>
						<label for="e-spec" class="mb-1 block text-base font-medium text-foreground">Linked Spec</label>
						<select id="e-spec" name="spec_id" bind:value={editItem.spec_id} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground">
							<option value="">None</option>
							{#each data.specs as s}<option value={s.id}>{s.title}</option>{/each}
						</select>
					</div>
					<div>
						<label for="e-task" class="mb-1 block text-base font-medium text-foreground">Linked Task</label>
						<select id="e-task" name="task_id" bind:value={editItem.task_id} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground">
							<option value="">None</option>
							{#each data.tasks as t}<option value={t.id}>{t.title}</option>{/each}
						</select>
					</div>
					<div class="sm:col-span-2">
						<label for="e-notes" class="mb-1 block text-base font-medium text-foreground">Notes</label>
						<textarea id="e-notes" name="notes" rows="2" bind:value={editItem.notes} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground"></textarea>
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
	<Modal bind:open={deleteOpen} title="Delete Test">
		{#if deleteItem}
			<p class="text-lg text-foreground">Delete <strong>{deleteItem.name}</strong>?</p>
			<p class="mt-1 text-base text-muted-foreground">This cannot be undone.</p>
			<form method="POST" action="?/delete" use:enhance={() => { deleteSubmitting = true;
				return async ({ result }) => { deleteSubmitting = false;
					if (result.type !== 'failure') { deleteOpen = false; await invalidateAll(); }
				};
			}}>
				<input type="hidden" name="id" value={deleteItem.id} />
				<input type="hidden" name="name" value={deleteItem.name} />
				<div class="mt-6 flex gap-3">
					<button type="submit" disabled={deleteSubmitting} class="flex items-center gap-2 rounded-lg bg-destructive px-6 py-3 text-base font-semibold text-white hover:bg-destructive/90 disabled:opacity-60">
						{#if deleteSubmitting}<Loader size={18} class="animate-spin" />Deleting...{:else}<Trash2 size={18} />Delete{/if}
					</button>
					<button type="button" onclick={() => (deleteOpen = false)} class="rounded-lg bg-secondary px-6 py-3 text-base font-medium text-foreground hover:bg-accent">Cancel</button>
				</div>
			</form>
		{/if}
	</Modal>

	{#if data.tests.length === 0}
		<EmptyState icon={FlaskConical} title="No tests yet" description="Add your first test." />
	{:else}
		<!-- Mobile card view -->
		<div class="mt-6 space-y-3 sm:hidden">
			{#each data.tests as test}
				<div class="rounded-xl border border-border bg-card p-4">
					<div class="flex items-start justify-between gap-2">
						<p class="text-base font-semibold text-foreground">{test.name}</p>
						<div class="flex shrink-0 items-center gap-1">
							<button onclick={() => openEdit(test)} class="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Edit"><Pencil size={14} /></button>
							<button onclick={() => openDelete(test)} class="rounded p-1.5 text-muted-foreground hover:bg-red-900/40 hover:text-red-300" aria-label="Delete"><Trash2 size={14} /></button>
						</div>
					</div>
					<div class="mt-2 flex flex-wrap items-center gap-2">
						<StatusBadge status={test.type} size="sm" />
						<StatusBadge status={test.status} size="sm" />
						<span class="text-xs text-muted-foreground">{timeAgo(test.last_run)}</span>
					</div>
					{#if specName(test.spec_id) || taskNameOf(test.task_id)}
						<div class="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
							{#if specName(test.spec_id)}<span>Spec: {specName(test.spec_id)}</span>{/if}
							{#if taskNameOf(test.task_id)}<span>Task: {taskNameOf(test.task_id)}</span>{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
		<!-- Desktop table view -->
		<div class="mt-6 hidden overflow-x-auto rounded-xl border border-border sm:block">
			<table class="w-full text-left">
				<thead class="border-b border-border bg-secondary/50">
					<tr>
						<th class="px-5 py-3 text-sm font-semibold text-foreground">Test Name</th>
						<th class="px-5 py-3 text-sm font-semibold text-foreground">Type</th>
						<th class="px-5 py-3 text-sm font-semibold text-foreground">Status</th>
						<th class="hidden px-5 py-3 text-sm font-semibold text-foreground md:table-cell">Last Run</th>
						<th class="hidden px-5 py-3 text-sm font-semibold text-foreground lg:table-cell">Spec</th>
						<th class="hidden px-5 py-3 text-sm font-semibold text-foreground lg:table-cell">Task</th>
						<th class="hidden px-5 py-3 text-sm font-semibold text-foreground xl:table-cell">Notes</th>
						<th class="px-5 py-3"></th>
					</tr>
				</thead>
				<tbody>
					{#each data.tests as test}
						<tr class="group border-b border-border transition-colors hover:bg-secondary/30">
							<td class="max-w-[200px] truncate px-5 py-3 text-base font-semibold text-foreground">{test.name}</td>
							<td class="px-5 py-3"><StatusBadge status={test.type} size="sm" /></td>
							<td class="px-5 py-3"><StatusBadge status={test.status} size="sm" /></td>
							<td class="hidden px-5 py-3 text-sm text-muted-foreground md:table-cell">{timeAgo(test.last_run)}</td>
							<td class="hidden px-5 py-3 text-sm text-muted-foreground lg:table-cell">{specName(test.spec_id) || '--'}</td>
							<td class="hidden px-5 py-3 text-sm text-muted-foreground lg:table-cell">{taskNameOf(test.task_id) || '--'}</td>
							<td class="hidden max-w-[150px] truncate px-5 py-3 text-sm text-muted-foreground xl:table-cell">{test.notes ?? '--'}</td>
							<td class="px-5 py-3">
								<div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
									<button onclick={() => openEdit(test)} class="rounded p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Edit"><Pencil size={16} /></button>
									<button onclick={() => openDelete(test)} class="rounded p-2 text-muted-foreground hover:bg-red-900/40 hover:text-red-300" aria-label="Delete"><Trash2 size={16} /></button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

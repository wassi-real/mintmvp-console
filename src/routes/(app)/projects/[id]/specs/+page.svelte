<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { FileText, Plus, ChevronDown, ChevronUp, Loader, Pencil, Trash2 } from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();
	let expandedSpec = $state<string | null>(null);

	function toggleSpec(id: string) {
		expandedSpec = expandedSpec === id ? null : id;
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

	function openEdit(s: any) {
		editItem = { ...s };
		editError = '';
		editOpen = true;
		expandedSpec = null;
	}

	// delete
	let deleteOpen = $state(false);
	let deleteItem = $state<any>(null);
	let deleteSubmitting = $state(false);

	function openDelete(s: any) { deleteItem = s; deleteOpen = true; }
</script>

<div>
	<PageHeader title="Specs" description="Feature specifications">
		{#snippet actions()}
			<button onclick={() => { createError = ''; createOpen = true; }}
				class="flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
				<Plus size={20} /> New Spec
			</button>
		{/snippet}
	</PageHeader>

	<!-- Create -->
	<Modal bind:open={createOpen} title="Create Spec">
		<form method="POST" action="?/create" use:enhance={() => { createSubmitting = true; createError = '';
			return async ({ result }) => { createSubmitting = false;
				if (result.type === 'failure') createError = (result.data as any)?.error ?? 'Error';
				else { createOpen = false; await invalidateAll(); }
			};
		}}>
			{#if createError}<div class="mb-4 rounded-lg bg-red-900/30 px-4 py-3 text-base text-red-300">{createError}</div>{/if}
			<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<div>
					<label for="c-title" class="mb-1 block text-base font-medium text-foreground">Title <span class="text-destructive">*</span></label>
					<input id="c-title" name="title" required class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground" />
				</div>
				<div>
					<label for="c-status" class="mb-1 block text-base font-medium text-foreground">Status</label>
					<select id="c-status" name="status" class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground">
						<option value="draft">Draft</option><option value="approved">Approved</option>
						<option value="in_dev">In Dev</option><option value="completed">Completed</option>
					</select>
				</div>
				<div class="lg:col-span-2">
					<label for="c-summary" class="mb-1 block text-base font-medium text-foreground">Summary</label>
					<textarea id="c-summary" name="summary" rows="2" class="w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground"></textarea>
				</div>
				<div class="lg:col-span-2">
					<label for="c-goal" class="mb-1 block text-base font-medium text-foreground">Goal</label>
					<textarea id="c-goal" name="goal" rows="2" class="w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground"></textarea>
				</div>
				<div>
					<label for="c-ac" class="mb-1 block text-base font-medium text-foreground">Acceptance Criteria</label>
					<textarea id="c-ac" name="acceptance_criteria" rows="3" class="w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground"></textarea>
				</div>
				<div>
					<label for="c-ec" class="mb-1 block text-base font-medium text-foreground">Edge Cases</label>
					<textarea id="c-ec" name="edge_cases" rows="3" class="w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground"></textarea>
				</div>
				<div class="lg:col-span-2">
					<label for="c-rr" class="mb-1 block text-base font-medium text-foreground">Regression Risks</label>
					<textarea id="c-rr" name="regression_risks" rows="2" class="w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground"></textarea>
				</div>
			</div>
			<div class="mt-6 flex gap-3">
				<button type="submit" disabled={createSubmitting} class="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
					{#if createSubmitting}<Loader size={18} class="animate-spin" />Creating...{:else}Create Spec{/if}
				</button>
				<button type="button" onclick={() => (createOpen = false)} class="rounded-lg bg-secondary px-6 py-3 text-base font-medium text-foreground hover:bg-accent">Cancel</button>
			</div>
		</form>
	</Modal>

	<!-- Edit -->
	<Modal bind:open={editOpen} title="Edit Spec">
		{#if editItem}
			<form method="POST" action="?/update" use:enhance={() => { editSubmitting = true; editError = '';
				return async ({ result }) => { editSubmitting = false;
					if (result.type === 'failure') editError = (result.data as any)?.error ?? 'Error';
					else { editOpen = false; await invalidateAll(); }
				};
			}}>
				{#if editError}<div class="mb-4 rounded-lg bg-red-900/30 px-4 py-3 text-base text-red-300">{editError}</div>{/if}
				<input type="hidden" name="id" value={editItem.id} />
				<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
					<div>
						<label for="e-title" class="mb-1 block text-base font-medium text-foreground">Title <span class="text-destructive">*</span></label>
						<input id="e-title" name="title" required bind:value={editItem.title} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground" />
					</div>
					<div>
						<label for="e-status" class="mb-1 block text-base font-medium text-foreground">Status</label>
						<select id="e-status" name="status" bind:value={editItem.status} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground">
							<option value="draft">Draft</option><option value="approved">Approved</option>
							<option value="in_dev">In Dev</option><option value="completed">Completed</option>
						</select>
					</div>
					<div class="lg:col-span-2">
						<label for="e-summary" class="mb-1 block text-base font-medium text-foreground">Summary</label>
						<textarea id="e-summary" name="summary" rows="2" bind:value={editItem.summary} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground"></textarea>
					</div>
					<div class="lg:col-span-2">
						<label for="e-goal" class="mb-1 block text-base font-medium text-foreground">Goal</label>
						<textarea id="e-goal" name="goal" rows="2" bind:value={editItem.goal} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground"></textarea>
					</div>
					<div>
						<label for="e-ac" class="mb-1 block text-base font-medium text-foreground">Acceptance Criteria</label>
						<textarea id="e-ac" name="acceptance_criteria" rows="3" bind:value={editItem.acceptance_criteria} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground"></textarea>
					</div>
					<div>
						<label for="e-ec" class="mb-1 block text-base font-medium text-foreground">Edge Cases</label>
						<textarea id="e-ec" name="edge_cases" rows="3" bind:value={editItem.edge_cases} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground"></textarea>
					</div>
					<div class="lg:col-span-2">
						<label for="e-rr" class="mb-1 block text-base font-medium text-foreground">Regression Risks</label>
						<textarea id="e-rr" name="regression_risks" rows="2" bind:value={editItem.regression_risks} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground"></textarea>
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
	<Modal bind:open={deleteOpen} title="Delete Spec">
		{#if deleteItem}
			<p class="text-lg text-foreground">Delete spec <strong>{deleteItem.title}</strong>?</p>
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

	{#if data.specs.length === 0}
		<EmptyState icon={FileText} title="No specs yet" description="Create your first feature specification." />
	{:else}
		<div class="mt-6 space-y-3">
			{#each data.specs as spec}
				<div class="group rounded-xl border border-border bg-card">
					<div class="flex w-full items-center justify-between px-6 py-5">
						<button onclick={() => toggleSpec(spec.id)} class="flex flex-1 items-center gap-4 text-left">
							<h3 class="text-lg font-semibold text-foreground">{spec.title}</h3>
							<StatusBadge status={spec.status} />
						</button>
						<div class="flex items-center gap-1">
							<div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
								<button onclick={() => openEdit(spec)} class="rounded p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Edit spec"><Pencil size={16} /></button>
								<button onclick={() => openDelete(spec)} class="rounded p-2 text-muted-foreground hover:bg-red-900/40 hover:text-red-300" aria-label="Delete spec"><Trash2 size={16} /></button>
							</div>
							<button onclick={() => toggleSpec(spec.id)} class="ml-2 rounded p-2 text-muted-foreground hover:bg-secondary" aria-label="Toggle">
								{#if expandedSpec === spec.id}
									<ChevronUp size={20} />
								{:else}
									<ChevronDown size={20} />
								{/if}
							</button>
						</div>
					</div>

					{#if expandedSpec === spec.id}
						<div class="border-t border-border px-6 py-5">
							<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
								{#if spec.summary}
									<div><p class="mb-1 text-sm font-semibold uppercase text-muted-foreground">Summary</p><p class="text-base text-foreground">{spec.summary}</p></div>
								{/if}
								{#if spec.goal}
									<div><p class="mb-1 text-sm font-semibold uppercase text-muted-foreground">Goal</p><p class="text-base text-foreground">{spec.goal}</p></div>
								{/if}
								{#if spec.acceptance_criteria}
									<div><p class="mb-1 text-sm font-semibold uppercase text-muted-foreground">Acceptance Criteria</p><p class="text-base text-foreground">{spec.acceptance_criteria}</p></div>
								{/if}
								{#if spec.edge_cases}
									<div><p class="mb-1 text-sm font-semibold uppercase text-muted-foreground">Edge Cases</p><p class="text-base text-foreground">{spec.edge_cases}</p></div>
								{/if}
								{#if spec.regression_risks}
									<div class="lg:col-span-2"><p class="mb-1 text-sm font-semibold uppercase text-muted-foreground">Regression Risks</p><p class="text-base text-foreground">{spec.regression_risks}</p></div>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<script lang="ts">
	import PageTitleBar from '$lib/components/PageTitleBar.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import {
		FlaskConical,
		Plus,
		Loader,
		Pencil,
		Trash2,
		Search,
		CheckCircle2,
		XCircle,
		CircleDashed,
		ListChecks
	} from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	const total = $derived(data.tests.length);
	const passCount = $derived(data.tests.filter((t) => t.status === 'pass').length);
	const failCount = $derived(data.tests.filter((t) => t.status === 'fail').length);
	const pendingCount = $derived(data.tests.filter((t) => t.status === 'pending').length);
	const passRate = $derived(total > 0 ? Math.round((passCount / total) * 100) : 0);

	const summary = $derived([
		{ label: 'Total', value: total, icon: ListChecks, tone: 'text-foreground' },
		{
			label: 'Passing',
			value: passCount,
			icon: CheckCircle2,
			tone: passCount > 0 ? 'text-success' : 'text-foreground'
		},
		{
			label: 'Failing',
			value: failCount,
			icon: XCircle,
			tone: failCount > 0 ? 'text-destructive' : 'text-foreground'
		},
		{
			label: 'Pending',
			value: pendingCount,
			icon: CircleDashed,
			tone: pendingCount > 0 ? 'text-warning' : 'text-foreground'
		}
	]);

	// Client-side narrowing of the list only — the server always returns every test.
	let query = $state('');
	let statusFilter = $state('all');

	const statusFilters = $derived([
		{ id: 'all', label: 'All', count: total },
		{ id: 'pass', label: 'Pass', count: passCount },
		{ id: 'fail', label: 'Fail', count: failCount },
		{ id: 'pending', label: 'Pending', count: pendingCount }
	]);

	const visibleTests = $derived(
		data.tests.filter((t) => {
			if (statusFilter !== 'all' && t.status !== statusFilter) return false;
			const q = query.trim().toLowerCase();
			if (!q) return true;
			return (
				t.name.toLowerCase().includes(q) ||
				t.type.toLowerCase().includes(q) ||
				(t.notes ?? '').toLowerCase().includes(q)
			);
		})
	);

	const filtered = $derived(statusFilter !== 'all' || query.trim().length > 0);

	function clearFilters() {
		statusFilter = 'all';
		query = '';
	}

	function delay(i: number) {
		return `${Math.min(i, 8) * 40}ms`;
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

	const fieldClass =
		'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground';
	const labelClass = 'mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground';
</script>

<PageTitleBar title="Tests" description="Suite health for this project">
	{#snippet meta()}
		<span class="inline-flex items-center gap-1.5">
			<CheckCircle2 size={14} class="text-success" />
			<span class="tabular-nums text-foreground">{passCount}</span> passing
		</span>
		<span class="text-border">|</span>
		<span class="inline-flex items-center gap-1.5">
			<XCircle size={14} class={failCount > 0 ? 'text-destructive' : 'text-muted-foreground'} />
			<span class="tabular-nums text-foreground">{failCount}</span> failing
		</span>
		<span class="text-border">|</span>
		<span class="inline-flex items-center gap-1.5">
			<CircleDashed size={14} class="text-muted-foreground" />
			<span class="tabular-nums text-foreground">{pendingCount}</span> pending
		</span>
	{/snippet}
	{#snippet actions()}
		<button
			onclick={() => { createError = ''; createOpen = true; }}
			class="press inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
		>
			<Plus size={15} /> Add test
		</button>
	{/snippet}
</PageTitleBar>

<!-- Create -->
<Modal bind:open={createOpen} title="Add Test">
	<form method="POST" action="?/create" use:enhance={() => { createSubmitting = true; createError = '';
		return async ({ result }) => { createSubmitting = false;
			if (result.type === 'failure') createError = (result.data as any)?.error ?? 'Error';
			else { createOpen = false; await invalidateAll(); }
		};
	}}>
		{#if createError}
			<div class="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-foreground">{createError}</div>
		{/if}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<div class="sm:col-span-2">
				<label for="c-name" class={labelClass}>Test name <span class="text-destructive">*</span></label>
				<input id="c-name" name="name" required class={fieldClass} placeholder="Signup flow test" />
			</div>
			<div>
				<label for="c-type" class={labelClass}>Type</label>
				<select id="c-type" name="type" class={fieldClass}>
					<option value="unit">Unit</option><option value="integration">Integration</option>
					<option value="e2e">E2E</option><option value="smoke">Smoke</option><option value="manual" selected>Manual</option>
				</select>
			</div>
			<div>
				<label for="c-status" class={labelClass}>Status</label>
				<select id="c-status" name="status" class={fieldClass}>
					<option value="pending" selected>Pending</option><option value="pass">Pass</option><option value="fail">Fail</option>
				</select>
			</div>
			<div>
				<label for="c-spec" class={labelClass}>Linked spec</label>
				<select id="c-spec" name="spec_id" class={fieldClass}>
					<option value="">None</option>
					{#each data.specs as s (s.id)}<option value={s.id}>{s.title}</option>{/each}
				</select>
			</div>
			<div>
				<label for="c-task" class={labelClass}>Linked task</label>
				<select id="c-task" name="task_id" class={fieldClass}>
					<option value="">None</option>
					{#each data.tasks as t (t.id)}<option value={t.id}>{t.title}</option>{/each}
				</select>
			</div>
			<div class="sm:col-span-2">
				<label for="c-notes" class={labelClass}>Notes</label>
				<textarea id="c-notes" name="notes" rows="2" class={fieldClass} placeholder="Optional notes..."></textarea>
			</div>
		</div>
		<div class="mt-6 flex gap-2">
			<button type="submit" disabled={createSubmitting} class="press inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60">
				{#if createSubmitting}<Loader size={16} class="animate-spin" />Adding...{:else}Add test{/if}
			</button>
			<button type="button" onclick={() => (createOpen = false)} class="press rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent">Cancel</button>
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
			{#if editError}
				<div class="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-foreground">{editError}</div>
			{/if}
			<input type="hidden" name="id" value={editItem.id} />
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div class="sm:col-span-2">
					<label for="e-name" class={labelClass}>Test name <span class="text-destructive">*</span></label>
					<input id="e-name" name="name" required bind:value={editItem.name} class={fieldClass} />
				</div>
				<div>
					<label for="e-type" class={labelClass}>Type</label>
					<select id="e-type" name="type" bind:value={editItem.type} class={fieldClass}>
						<option value="unit">Unit</option><option value="integration">Integration</option>
						<option value="e2e">E2E</option><option value="smoke">Smoke</option><option value="manual">Manual</option>
					</select>
				</div>
				<div>
					<label for="e-status" class={labelClass}>Status</label>
					<select id="e-status" name="status" bind:value={editItem.status} class={fieldClass}>
						<option value="pending">Pending</option><option value="pass">Pass</option><option value="fail">Fail</option>
					</select>
				</div>
				<div>
					<label for="e-spec" class={labelClass}>Linked spec</label>
					<select id="e-spec" name="spec_id" bind:value={editItem.spec_id} class={fieldClass}>
						<option value="">None</option>
						{#each data.specs as s (s.id)}<option value={s.id}>{s.title}</option>{/each}
					</select>
				</div>
				<div>
					<label for="e-task" class={labelClass}>Linked task</label>
					<select id="e-task" name="task_id" bind:value={editItem.task_id} class={fieldClass}>
						<option value="">None</option>
						{#each data.tasks as t (t.id)}<option value={t.id}>{t.title}</option>{/each}
					</select>
				</div>
				<div class="sm:col-span-2">
					<label for="e-notes" class={labelClass}>Notes</label>
					<textarea id="e-notes" name="notes" rows="2" bind:value={editItem.notes} class={fieldClass}></textarea>
				</div>
			</div>
			<div class="mt-6 flex gap-2">
				<button type="submit" disabled={editSubmitting} class="press inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60">
					{#if editSubmitting}<Loader size={16} class="animate-spin" />Saving...{:else}Save changes{/if}
				</button>
				<button type="button" onclick={() => (editOpen = false)} class="press rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent">Cancel</button>
			</div>
		</form>
	{/if}
</Modal>

<!-- Delete -->
<Modal bind:open={deleteOpen} title="Delete Test">
	{#if deleteItem}
		<p class="text-sm text-foreground">Delete <strong>{deleteItem.name}</strong>?</p>
		<p class="mt-1 text-sm text-muted-foreground">This cannot be undone.</p>
		<form method="POST" action="?/delete" use:enhance={() => { deleteSubmitting = true;
			return async ({ result }) => { deleteSubmitting = false;
				if (result.type !== 'failure') { deleteOpen = false; await invalidateAll(); }
			};
		}}>
			<input type="hidden" name="id" value={deleteItem.id} />
			<input type="hidden" name="name" value={deleteItem.name} />
			<div class="mt-6 flex gap-2">
				<button type="submit" disabled={deleteSubmitting} class="press inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-60">
					{#if deleteSubmitting}<Loader size={16} class="animate-spin" />Deleting...{:else}<Trash2 size={16} />Delete{/if}
				</button>
				<button type="button" onclick={() => (deleteOpen = false)} class="press rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent">Cancel</button>
			</div>
		</form>
	{/if}
</Modal>

{#if total === 0}
	<div class="rise rounded-xl border border-dashed border-border bg-card/40">
		<EmptyState
			icon={FlaskConical}
			title="No tests yet"
			description="Track unit, integration, E2E, smoke, and manual checks here. Add your first test to get started."
		/>
	</div>
{:else}
	<!-- Suite summary -->
	<section class="rise rounded-xl border border-border bg-card p-4 sm:p-5" style:--delay="0ms">
		<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
			{#each summary as s (s.label)}
				<div class="rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
					<div class="flex items-center justify-between gap-2">
						<p class="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
							{s.label}
						</p>
						<s.icon size={14} class="shrink-0 text-muted-foreground" />
					</div>
					<p class="mt-1 text-xl font-bold tabular-nums {s.tone}">{s.value}</p>
				</div>
			{/each}
		</div>

		<div class="mt-4">
			<div class="flex items-baseline justify-between gap-3">
				<p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Pass rate</p>
				<p class="text-sm font-bold tabular-nums {failCount > 0 ? 'text-warning' : 'text-success'}">
					{passRate}%
				</p>
			</div>
			<div class="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
				<div
					class="h-full rounded-full bg-success transition-[width] duration-300 ease-out motion-reduce:transition-none"
					style:width="{passRate}%"
				></div>
			</div>
		</div>
	</section>

	<!-- Filters -->
	<div class="rise mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" style:--delay="80ms">
		<div class="flex flex-wrap items-center gap-1.5">
			{#each statusFilters as f (f.id)}
				<button
					type="button"
					onclick={() => (statusFilter = f.id)}
					class="press inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors {statusFilter ===
					f.id
						? 'border-border bg-secondary text-foreground'
						: 'border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}"
				>
					{f.label}
					<span class="tabular-nums text-muted-foreground">{f.count}</span>
				</button>
			{/each}
		</div>
		<div class="relative sm:w-64">
			<Search
				size={14}
				class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
			/>
			<input
				type="search"
				bind:value={query}
				aria-label="Search tests"
				placeholder="Search tests..."
				class="w-full rounded-lg border border-input bg-card py-1.5 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground"
			/>
		</div>
	</div>

	{#if visibleTests.length === 0}
		<div class="mt-4 rounded-xl border border-dashed border-border bg-card/40 px-4 py-10 text-center">
			<p class="text-sm font-medium text-foreground">No tests match these filters</p>
			<button
				type="button"
				onclick={clearFilters}
				class="press mt-3 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
			>
				Clear filters
			</button>
		</div>
	{:else}
		<!-- Mobile cards -->
		<div class="mt-4 space-y-2 sm:hidden">
			{#each visibleTests as test, i (test.id)}
				<div class="rise card-hover rounded-xl border border-border bg-card p-4" style:--delay={delay(i)}>
					<div class="flex items-start justify-between gap-2">
						<p class="min-w-0 flex-1 break-words text-sm font-semibold text-foreground">{test.name}</p>
						<div class="flex shrink-0 items-center gap-1">
							<button onclick={() => openEdit(test)} class="press rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="Edit {test.name}"><Pencil size={14} /></button>
							<button onclick={() => openDelete(test)} class="press rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive" aria-label="Delete {test.name}"><Trash2 size={14} /></button>
						</div>
					</div>
					<div class="mt-2 flex flex-wrap items-center gap-2">
						<StatusBadge status={test.type} size="sm" />
						<StatusBadge status={test.status} size="sm" />
						<span class="text-xs tabular-nums text-muted-foreground">{timeAgo(test.last_run)}</span>
					</div>
					{#if specName(test.spec_id) || taskNameOf(test.task_id)}
						<div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
							{#if specName(test.spec_id)}<span class="truncate">Spec: {specName(test.spec_id)}</span>{/if}
							{#if taskNameOf(test.task_id)}<span class="truncate">Task: {taskNameOf(test.task_id)}</span>{/if}
						</div>
					{/if}
					{#if test.notes}
						<p class="mt-2 break-words text-xs text-muted-foreground">{test.notes}</p>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Desktop table -->
		<div class="mt-4 hidden overflow-x-auto rounded-xl border border-border bg-card sm:block">
			<table class="w-full text-left">
				<thead>
					<tr class="border-b border-border/60">
						<th class="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Test</th>
						<th class="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Type</th>
						<th class="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</th>
						<th class="hidden px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground md:table-cell">Last run</th>
						<th class="hidden px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:table-cell">Spec</th>
						<th class="hidden px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground lg:table-cell">Task</th>
						<th class="hidden px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground xl:table-cell">Notes</th>
						<th class="px-4 py-2.5"><span class="sr-only">Actions</span></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border/60">
					{#each visibleTests as test, i (test.id)}
						<tr class="rise row-hover" style:--delay={delay(i)}>
							<td class="max-w-[220px] truncate px-4 py-2.5 text-sm font-medium text-foreground" title={test.name}>{test.name}</td>
							<td class="px-4 py-2.5"><StatusBadge status={test.type} size="sm" /></td>
							<td class="px-4 py-2.5"><StatusBadge status={test.status} size="sm" /></td>
							<td class="hidden whitespace-nowrap px-4 py-2.5 text-xs tabular-nums text-muted-foreground md:table-cell">{timeAgo(test.last_run)}</td>
							<td class="hidden max-w-[160px] truncate px-4 py-2.5 text-xs text-muted-foreground lg:table-cell">{specName(test.spec_id) || '--'}</td>
							<td class="hidden max-w-[160px] truncate px-4 py-2.5 text-xs text-muted-foreground lg:table-cell">{taskNameOf(test.task_id) || '--'}</td>
							<td class="hidden max-w-[200px] truncate px-4 py-2.5 text-xs text-muted-foreground xl:table-cell" title={test.notes ?? ''}>{test.notes ?? '--'}</td>
							<td class="px-4 py-2.5">
								<div class="flex items-center justify-end gap-1">
									<button onclick={() => openEdit(test)} class="press rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="Edit {test.name}"><Pencil size={15} /></button>
									<button onclick={() => openDelete(test)} class="press rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive" aria-label="Delete {test.name}"><Trash2 size={15} /></button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if filtered}
			<p class="mt-3 text-xs tabular-nums text-muted-foreground">
				Showing {visibleTests.length} of {total} tests
			</p>
		{/if}
	{/if}
{/if}

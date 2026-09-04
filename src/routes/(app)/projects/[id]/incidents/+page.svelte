<script lang="ts">
	import PageTitleBar from '$lib/components/PageTitleBar.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { AlertTriangle, Plus, Loader, Pencil, Trash2, Search } from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	const openCount = $derived(data.incidents.filter((i: any) => i.status !== 'resolved').length);

	const counts = $derived({
		open: data.incidents.filter((i: any) => i.status === 'open').length,
		investigating: data.incidents.filter((i: any) => i.status === 'investigating').length,
		resolved: data.incidents.filter((i: any) => i.status === 'resolved').length,
		urgent: data.incidents.filter(
			(i: any) => i.status !== 'resolved' && (i.severity === 'critical' || i.severity === 'high')
		).length
	});

	const stats = $derived([
		{
			label: 'Unresolved',
			value: openCount,
			tone: openCount > 0 ? 'text-destructive' : 'text-foreground',
			sub: `${data.incidents.length} all time`
		},
		{
			label: 'High / critical',
			value: counts.urgent,
			tone: counts.urgent > 0 ? 'text-destructive' : 'text-foreground',
			sub: 'still unresolved'
		},
		{
			label: 'Investigating',
			value: counts.investigating,
			tone: counts.investigating > 0 ? 'text-warning' : 'text-foreground',
			sub: 'being worked on'
		},
		{
			label: 'Resolved',
			value: counts.resolved,
			tone: counts.resolved > 0 ? 'text-success' : 'text-foreground',
			sub: 'closed out'
		}
	]);

	const filters = [
		{ value: 'all', label: 'All' },
		{ value: 'open', label: 'Open' },
		{ value: 'investigating', label: 'Investigating' },
		{ value: 'resolved', label: 'Resolved' }
	] as const;

	let statusFilter = $state<'all' | 'open' | 'investigating' | 'resolved'>('all');
	let query = $state('');

	const visible = $derived(
		data.incidents.filter((i: any) => {
			if (statusFilter !== 'all' && i.status !== statusFilter) return false;
			const q = query.trim().toLowerCase();
			if (!q) return true;
			return `${i.title} ${i.description ?? ''}`.toLowerCase().includes(q);
		})
	);

	function filterCount(value: (typeof filters)[number]['value']) {
		if (value === 'all') return data.incidents.length;
		return counts[value];
	}

	function formatDate(dateStr: string | null): string {
		if (!dateStr) return '--';
		return new Date(dateStr).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function delay(i: number) {
		return `${Math.min(i, 8) * 40}ms`;
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

	function openEdit(i: any) {
		editItem = { ...i };
		editError = '';
		editOpen = true;
	}

	// delete
	let deleteOpen = $state(false);
	let deleteItem = $state<any>(null);
	let deleteSubmitting = $state(false);

	function openDelete(i: any) {
		deleteItem = i;
		deleteOpen = true;
	}
</script>

<PageTitleBar title="Incidents">
	{#snippet meta()}
		{#if openCount === 0}
			<span class="live-dot"></span>
			<span>No open incidents</span>
		{:else}
			<span class="font-semibold tabular-nums text-destructive">{openCount} unresolved</span>
		{/if}
		<span aria-hidden="true" class="opacity-40">·</span>
		<span class="tabular-nums">{data.incidents.length} reported</span>
	{/snippet}
	{#snippet actions()}
		<button
			onclick={() => {
				createError = '';
				createOpen = true;
			}}
			class="press inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
		>
			<Plus size={15} /> Report incident
		</button>
	{/snippet}
</PageTitleBar>

<!-- Create -->
<Modal bind:open={createOpen} title="Report Incident">
	<form
		method="POST"
		action="?/create"
		use:enhance={() => {
			createSubmitting = true;
			createError = '';
			return async ({ result }) => {
				createSubmitting = false;
				if (result.type === 'failure') createError = (result.data as any)?.error ?? 'Error';
				else {
					createOpen = false;
					await invalidateAll();
				}
			};
		}}
	>
		{#if createError}
			<div
				class="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
			>
				{createError}
			</div>
		{/if}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<div class="sm:col-span-2">
				<label
					for="c-title"
					class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
					>Title <span class="text-destructive">*</span></label
				>
				<input
					id="c-title"
					name="title"
					required
					class="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground"
					placeholder="Score not updating"
				/>
			</div>
			<div>
				<label
					for="c-severity"
					class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
					>Severity</label
				>
				<select
					id="c-severity"
					name="severity"
					class="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground"
				>
					<option value="low">Low</option><option value="medium" selected>Medium</option>
					<option value="high">High</option><option value="critical">Critical</option>
				</select>
			</div>
			<div>
				<label
					for="c-status"
					class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
					>Status</label
				>
				<select
					id="c-status"
					name="status"
					class="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground"
				>
					<option value="open" selected>Open</option><option value="investigating"
						>Investigating</option
					><option value="resolved">Resolved</option>
				</select>
			</div>
			<div class="sm:col-span-2">
				<label
					for="c-desc"
					class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
					>Description</label
				>
				<textarea
					id="c-desc"
					name="description"
					rows="3"
					class="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground"
					placeholder="Describe the issue..."
				></textarea>
			</div>
		</div>
		<div class="mt-6 flex gap-2">
			<button
				type="submit"
				disabled={createSubmitting}
				class="press inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
			>
				{#if createSubmitting}<Loader size={15} class="animate-spin" />Reporting...{:else}Report
					incident{/if}
			</button>
			<button
				type="button"
				onclick={() => (createOpen = false)}
				class="press rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
				>Cancel</button
			>
		</div>
	</form>
</Modal>

<!-- Edit -->
<Modal bind:open={editOpen} title="Edit Incident">
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
			<input type="hidden" name="wasResolved" value={String(editItem.status === 'resolved')} />
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div class="sm:col-span-2">
					<label
						for="e-title"
						class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
						>Title <span class="text-destructive">*</span></label
					>
					<input
						id="e-title"
						name="title"
						required
						bind:value={editItem.title}
						class="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground"
					/>
				</div>
				<div>
					<label
						for="e-severity"
						class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
						>Severity</label
					>
					<select
						id="e-severity"
						name="severity"
						bind:value={editItem.severity}
						class="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground"
					>
						<option value="low">Low</option><option value="medium">Medium</option>
						<option value="high">High</option><option value="critical">Critical</option>
					</select>
				</div>
				<div>
					<label
						for="e-status"
						class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
						>Status</label
					>
					<select
						id="e-status"
						name="status"
						bind:value={editItem.status}
						class="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground"
					>
						<option value="open">Open</option><option value="investigating">Investigating</option
						><option value="resolved">Resolved</option>
					</select>
				</div>
				<div class="sm:col-span-2">
					<label
						for="e-desc"
						class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-muted-foreground"
						>Description</label
					>
					<textarea
						id="e-desc"
						name="description"
						rows="3"
						bind:value={editItem.description}
						class="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground"
					></textarea>
				</div>
			</div>
			<div class="mt-6 flex gap-2">
				<button
					type="submit"
					disabled={editSubmitting}
					class="press inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
				>
					{#if editSubmitting}<Loader size={15} class="animate-spin" />Saving...{:else}Save changes{/if}
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

<!-- Delete -->
<Modal bind:open={deleteOpen} title="Delete Incident">
	{#if deleteItem}
		<p class="text-sm text-foreground">
			Delete incident <strong class="font-semibold">{deleteItem.title}</strong>?
		</p>
		<p class="mt-1 text-sm text-muted-foreground">This cannot be undone.</p>
		<form
			method="POST"
			action="?/delete"
			use:enhance={() => {
				deleteSubmitting = true;
				return async ({ result }) => {
					deleteSubmitting = false;
					if (result.type !== 'failure') {
						deleteOpen = false;
						await invalidateAll();
					}
				};
			}}
		>
			<input type="hidden" name="id" value={deleteItem.id} />
			<input type="hidden" name="title" value={deleteItem.title} />
			<div class="mt-6 flex gap-2">
				<button
					type="submit"
					disabled={deleteSubmitting}
					class="press inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-60"
				>
					{#if deleteSubmitting}<Loader size={15} class="animate-spin" />Deleting...{:else}<Trash2
							size={15}
						/>Delete{/if}
				</button>
				<button
					type="button"
					onclick={() => (deleteOpen = false)}
					class="press rounded-lg border border-border bg-secondary px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
					>Cancel</button
				>
			</div>
		</form>
	{/if}
</Modal>

{#if data.incidents.length === 0}
	<EmptyState icon={AlertTriangle} title="No incidents" description="No bugs or issues reported." />
{:else}
	<!-- Grouped counts -->
	<div class="rise rounded-xl border border-border bg-card p-4 sm:p-5" style:--delay="0ms">
		<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
			{#each stats as s (s.label)}
				<div class="rounded-lg border border-border bg-secondary/30 px-4 py-3">
					<p class="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
						{s.label}
					</p>
					<p class="mt-1 text-xl font-bold tabular-nums {s.tone}">{s.value}</p>
					<p class="mt-0.5 truncate text-xs text-muted-foreground">{s.sub}</p>
				</div>
			{/each}
		</div>
	</div>

	<!-- Filters -->
	<div class="rise mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" style:--delay="80ms">
		<div class="flex flex-wrap gap-1.5">
			{#each filters as f (f.value)}
				<button
					type="button"
					onclick={() => (statusFilter = f.value)}
					aria-pressed={statusFilter === f.value}
					class="press rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors {statusFilter ===
					f.value
						? 'border-border bg-secondary text-foreground'
						: 'border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground'}"
				>
					{f.label}
					<span class="ml-1 tabular-nums opacity-60">{filterCount(f.value)}</span>
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
				placeholder="Search incidents"
				aria-label="Search incidents"
				class="w-full rounded-lg border border-input bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground"
			/>
		</div>
	</div>

	<!-- Table -->
	<div class="mt-4 overflow-hidden rounded-xl border border-border bg-card">
		<div class="overflow-x-auto">
			<table class="w-full text-left text-sm">
				<thead>
					<tr class="border-b border-border bg-secondary/40">
						<th class="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"
							>Incident</th
						>
						<th class="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"
							>Severity</th
						>
						<th class="px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"
							>Status</th
						>
						<th
							class="hidden px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:table-cell"
							>Created</th
						>
						<th
							class="hidden px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground md:table-cell"
							>Resolved</th
						>
						<th class="px-4 py-2.5"><span class="sr-only">Actions</span></th>
					</tr>
				</thead>
				<tbody>
					{#each visible as incident, i (incident.id)}
						<tr
							class="rise row-hover border-b border-border/60 last:border-0"
							style:--delay={delay(i)}
						>
							<td class="max-w-xs px-4 py-3 sm:max-w-md">
								<p class="font-medium text-foreground">{incident.title}</p>
								{#if incident.description}
									<p class="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
										{incident.description}
									</p>
								{/if}
							</td>
							<td class="px-4 py-3"><StatusBadge status={incident.severity} size="sm" /></td>
							<td class="px-4 py-3"><StatusBadge status={incident.status} size="sm" /></td>
							<td
								class="hidden whitespace-nowrap px-4 py-3 text-xs tabular-nums text-muted-foreground sm:table-cell"
								>{formatDate(incident.created_at)}</td
							>
							<td
								class="hidden whitespace-nowrap px-4 py-3 text-xs tabular-nums md:table-cell {incident.resolved_at
									? 'text-success'
									: 'text-muted-foreground'}">{formatDate(incident.resolved_at)}</td
							>
							<td class="px-4 py-3">
								<div class="flex items-center justify-end gap-1">
									<button
										onclick={() => openEdit(incident)}
										class="press rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
										aria-label="Edit {incident.title}"><Pencil size={14} /></button
									>
									<button
										onclick={() => openDelete(incident)}
										class="press rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
										aria-label="Delete {incident.title}"><Trash2 size={14} /></button
									>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		{#if visible.length === 0}
			<p class="px-4 py-10 text-center text-sm text-muted-foreground">
				No incidents match the current filter.
			</p>
		{/if}
	</div>
{/if}

<script lang="ts">
	import Folder from '@lucide/svelte/icons/folder';
	import NotebookText from '@lucide/svelte/icons/notebook-text';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';
	import Trash from '@lucide/svelte/icons/trash';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import Dialog from '#lib/components/Dialog.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Form from '#lib/components/Form.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import RecordDialog from '#lib/components/RecordDialog.svelte';
	import Time from '#lib/components/Time.svelte';
	import { reportFields, reportFolderFields } from '#lib/sections.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const base = $derived(`/dashboard/projects/${data.project.id}/reports`);
	let folder = $state('all');
	let query = $state('');
	let creating = $state(false);
	let managing = $state(false);
	let folderEditing = $state<{ id: string; name: string } | null>(null);
	let folderOpen = $state(false);
	let folderDeleting = $state<{ id: string; name: string } | null>(null);
	let folderDeleteOpen = $state(false);

	const counts = $derived.by(() => {
		const map = new Map<string, number>();
		for (const report of data.reports) {
			const key = report.folder_id ?? 'none';
			map.set(key, (map.get(key) ?? 0) + 1);
		}
		return map;
	});
	const folderNames = $derived(new Map(data.folders.map((item) => [item.value, item.label])));

	const shown = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		return data.reports.filter((report) => {
			if (folder === 'none' && report.folder_id) return false;
			if (folder !== 'all' && folder !== 'none' && report.folder_id !== folder) return false;
			return !needle || report.title.toLowerCase().includes(needle) || report.created_by.toLowerCase().includes(needle);
		});
	});

	const fields = $derived(
		reportFields(data.folders).map((field) =>
			field.name === 'folder_id' && folder !== 'all' && folder !== 'none' ? { ...field, initial: folder } : field
		)
	);
</script>

<svelte:head>
	<title>Reports · {data.project.name}</title>
</svelte:head>

<PageHeader title="Reports" description="Written updates, findings and documents for this project.">
	{#if data.canEdit}
		<button type="button" class="btn" onclick={() => (managing = true)}><Folder size={19} /> Folders</button>
		<button type="button" class="btn btn-primary" onclick={() => (creating = true)}>
			<Plus size={20} /> New report
		</button>
	{/if}
</PageHeader>

{#if data.reports.length === 0}
	<EmptyState title="No reports yet" message="Write the first report, or let your tools send reports here with an API key.">
		{#if data.canEdit}
			<button type="button" class="btn btn-primary btn-lg" onclick={() => (creating = true)}>
				<Plus size={20} /> Write a report
			</button>
		{/if}
	</EmptyState>
{:else}
	<div class="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
		<!-- Folders -->
		<nav aria-label="Folders" class="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
			{#snippet folderButton(value: string, label: string, count: number)}
				<button
					type="button"
					class="nav-item shrink-0 border-0 bg-transparent text-left"
					aria-current={folder === value ? 'page' : undefined}
					onclick={() => (folder = value)}
				>
					<Folder size={19} class="shrink-0" />
					<span class="flex-1 truncate">{label}</span>
					<span class="text-[0.82rem] text-faint tabular-nums">{count}</span>
				</button>
			{/snippet}
			{@render folderButton('all', 'All reports', data.reports.length)}
			{#each data.folders as item (item.value)}
				{@render folderButton(item.value, item.label, counts.get(item.value) ?? 0)}
			{/each}
			{#if counts.get('none')}
				{@render folderButton('none', 'No folder', counts.get('none') ?? 0)}
			{/if}
		</nav>

		<div class="min-w-0">
			<label class="relative mb-5 block">
				<span class="sr-only">Search reports</span>
				<Search size={19} class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-faint" />
				<input type="search" class="input pl-11!" placeholder="Search {data.reports.length} reports" bind:value={query} />
			</label>

			{#if shown.length === 0}
				<EmptyState title="No reports here" message="Try another folder or a different search." />
			{:else}
				{#key folder}
					<div class="list animate-fade">
						{#each shown.slice(0, 300) as report (report.id)}
							<a href="{base}/{report.id}" class="list-row">
								<span class="flex size-11 shrink-0 items-center justify-center rounded-block bg-surface-2 text-muted" aria-hidden="true">
									<NotebookText size={20} />
								</span>
								<span class="min-w-0 flex-1">
									<span class="block truncate font-semibold">{report.title}</span>
									<span class="block truncate text-[0.88rem] text-muted">
										{report.created_by || 'Unknown author'}
										{#if folder === 'all' && report.folder_id}· {folderNames.get(report.folder_id) ?? ''}{/if}
									</span>
								</span>
								<span class="hidden shrink-0 text-[0.88rem] text-muted sm:block">
									<Time value={report.updated_at} relative />
								</span>
							</a>
						{/each}
					</div>
					{#if shown.length > 300}
						<p class="mt-4 text-center text-muted">Showing the newest 300 of {shown.length}. Search to narrow it down.</p>
					{/if}
				{/key}
			{/if}
		</div>
	</div>
{/if}

{#if data.canEdit}
	{#key folder}
		<RecordDialog bind:open={creating} noun="report" {fields} size="lg" />
	{/key}

	<Dialog bind:open={managing} title="Folders">
		{#if data.folders.length === 0}
			<p class="text-muted">No folders yet. Folders help you group reports by topic.</p>
		{:else}
			<ul class="grid gap-2">
				{#each data.folders as item (item.value)}
					<li class="flex items-center gap-2 rounded-block bg-surface-2 py-2 pr-2 pl-4">
						<Folder size={18} class="shrink-0 text-muted" />
						<span class="min-w-0 flex-1 truncate font-medium">{item.label}</span>
						<span class="text-[0.85rem] text-faint tabular-nums">{counts.get(item.value) ?? 0}</span>
						<button
							type="button"
							class="btn btn-ghost btn-sm btn-icon"
							aria-label="Rename {item.label}"
							title="Rename"
							onclick={() => {
								folderEditing = { id: item.value, name: item.label };
								managing = false;
								folderOpen = true;
							}}
						>
							<Pencil size={16} />
						</button>
						<button
							type="button"
							class="btn btn-ghost btn-sm btn-icon hover:text-bad"
							aria-label="Delete {item.label}"
							title="Delete"
							onclick={() => {
								folderDeleting = { id: item.value, name: item.label };
								managing = false;
								folderDeleteOpen = true;
							}}
						>
							<Trash size={16} />
						</button>
					</li>
				{/each}
			</ul>
		{/if}
		<Form action="?/createFolder" class="mt-6">
			{#snippet children({ pending })}
				<label class="label" for="new-folder">New folder</label>
				<div class="flex gap-3">
					<input id="new-folder" name="name" class="input min-w-0 flex-1" maxlength="80" required placeholder="For example: Weekly updates" />
					<button type="submit" class="btn btn-primary shrink-0" disabled={pending}><Plus size={18} /> Add</button>
				</div>
			{/snippet}
		</Form>
	</Dialog>

	{#key folderEditing?.id}
		<RecordDialog
			bind:open={folderOpen}
			noun="folder"
			fields={reportFolderFields}
			record={folderEditing}
			createAction="?/createFolder"
			updateAction="?/updateFolder"
		/>
	{/key}
	<ConfirmDialog
		bind:open={folderDeleteOpen}
		title="Delete this folder?"
		message={`The folder “${folderDeleting?.name ?? ''}” will be deleted. The reports inside it are kept and moved to “No folder”.`}
		action="?/deleteFolder"
		values={{ id: folderDeleting?.id ?? '' }}
		note=""
		onsuccess={() => {
			if (folder === folderDeleting?.id) folder = 'all';
		}}
	/>
{/if}
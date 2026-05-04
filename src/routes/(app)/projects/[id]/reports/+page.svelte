<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { createClient } from '$lib/supabase/client';
	import type { Tables } from '$lib/supabase/types';
	import {
		BookOpen,
		Plus,
		Trash2,
		Eye,
		Code2,
		Download,
		FileText,
		Loader,
		X,
		Save,
		Clock,
		Menu,
		GripVertical,
		Folder,
		FolderPlus,
		ChevronRight,
		ChevronDown,
		Pencil
	} from 'lucide-svelte';
	import { marked } from 'marked';

	let { data } = $props();

	const projectId = $derived($page.params.id ?? '');

	const SIDEBAR_LS_PREFIX = 'mintmvp-reports-sidebar-w:';
	const SIDEBAR_DEFAULT_PX = 288;

	const FOLDER_ICON_CHOICES = ['', '📁', '📊', '📝', '🎯', '✅', '📌', '💼', '🗂️', '🔒'];

	let sidebarWidthPx = $state(SIDEBAR_DEFAULT_PX);
	let mqlDesktop = $state(false);

	function sidebarClampLimits() {
		if (!browser) return { min: 200, max: 560 };
		const max = Math.min(560, Math.floor(window.innerWidth * 0.55));
		return { min: 200, max: Math.max(240, max) };
	}

	function clampSidebarWidth(w: number) {
		const { min, max } = sidebarClampLimits();
		return Math.min(max, Math.max(min, Math.round(w)));
	}

	function persistSidebarWidth() {
		if (!browser || !projectId) return;
		localStorage.setItem(SIDEBAR_LS_PREFIX + projectId, String(sidebarWidthPx));
	}

	function onSidebarResizePointerDown(e: MouseEvent) {
		e.preventDefault();
		const startX = e.clientX;
		const startW = sidebarWidthPx;
		document.body.style.cursor = 'col-resize';
		document.body.style.userSelect = 'none';

		const onMove = (ev: MouseEvent) => {
			const dx = ev.clientX - startX;
			sidebarWidthPx = clampSidebarWidth(startW + dx);
		};
		const onUp = () => {
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseup', onUp);
			document.body.style.cursor = '';
			document.body.style.userSelect = '';
			sidebarWidthPx = clampSidebarWidth(sidebarWidthPx);
			persistSidebarWidth();
		};
		window.addEventListener('mousemove', onMove);
		window.addEventListener('mouseup', onUp);
	}

	$effect(() => {
		if (!browser) return;
		const mq = window.matchMedia('(min-width: 640px)');
		const sync = () => {
			mqlDesktop = mq.matches;
		};
		sync();
		mq.addEventListener('change', sync);
		return () => mq.removeEventListener('change', sync);
	});

	$effect(() => {
		if (!browser || !projectId) return;
		const raw = localStorage.getItem(SIDEBAR_LS_PREFIX + projectId);
		const n = raw ? parseInt(raw, 10) : NaN;
		if (!Number.isNaN(n) && n >= 160) {
			sidebarWidthPx = clampSidebarWidth(n);
		}
	});

	$effect(() => {
		if (!browser || !mqlDesktop) return;
		const onResize = () => {
			sidebarWidthPx = clampSidebarWidth(sidebarWidthPx);
		};
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	});

	let reports: Tables<'reports'>[] = $state([]);
	let folders: Tables<'report_folders'>[] = $state([]);
	let expandedFolders: Record<string, boolean> = $state({});

	let clientError = $state('');

	$effect(() => {
		reports = [...data.reports];
	});
	$effect(() => {
		folders = [...data.folders];
	});

	$effect(() => {
		let changed = false;
		const next = { ...expandedFolders };
		for (const f of folders) {
			if (!(f.id in next)) {
				next[f.id] = true;
				changed = true;
			}
		}
		if (changed) expandedFolders = next;
	});

	const sortedFolders = $derived(
		[...folders].sort((a, b) =>
			a.sort_order !== b.sort_order ? a.sort_order - b.sort_order : a.name.localeCompare(b.name)
		)
	);

	function uncategorizedList() {
		return reports.filter((r) => !r.folder_id);
	}

	function reportsInFolder(fid: string) {
		return reports.filter((r) => r.folder_id === fid);
	}

	function folderIconEl(icon: string) {
		const t = icon?.trim();
		if (t) return t;
		return null;
	}

	function mergeReportPayload(
		payload: { eventType: string; new: Tables<'reports'> | null; old: Tables<'reports'> | null },
		pid: string
	) {
		const row = payload.new ?? payload.old;
		if (!row || row.project_id !== pid) return;
		const id = row.id;
		if (payload.eventType === 'DELETE') {
			reports = reports.filter((r) => r.id !== id);
			return;
		}
		if (payload.eventType === 'INSERT') {
			if (reports.some((r) => r.id === id)) return;
			reports = [row, ...reports];
			return;
		}
		if (payload.eventType === 'UPDATE') {
			const idx = reports.findIndex((r) => r.id === id);
			if (idx === -1) reports = [row, ...reports];
			else reports = reports.map((r) => (r.id === id ? { ...r, ...row } : r));
		}
	}

	function mergeFolderPayload(
		payload: {
			eventType: string;
			new: Tables<'report_folders'> | null;
			old: Tables<'report_folders'> | null;
		},
		pid: string
	) {
		const row = payload.new ?? payload.old;
		if (!row || row.project_id !== pid) return;
		const id = row.id;
		if (payload.eventType === 'DELETE') {
			folders = folders.filter((f) => f.id !== id);
			reports = reports.filter((r) => r.folder_id !== id);
			return;
		}
		if (payload.eventType === 'INSERT') {
			if (folders.some((f) => f.id === id)) return;
			folders = [...folders, row].sort((a, b) =>
				a.sort_order !== b.sort_order ? a.sort_order - b.sort_order : a.name.localeCompare(b.name)
			);
			return;
		}
		if (payload.eventType === 'UPDATE') {
			const idx = folders.findIndex((f) => f.id === id);
			if (idx === -1) {
				folders = [...folders, row].sort((a, b) =>
					a.sort_order !== b.sort_order ? a.sort_order - b.sort_order : a.name.localeCompare(b.name)
				);
			} else {
				folders = folders
					.map((f) => (f.id === id ? { ...f, ...row } : f))
					.sort((a, b) =>
						a.sort_order !== b.sort_order ? a.sort_order - b.sort_order : a.name.localeCompare(b.name)
					);
			}
		}
	}

	$effect(() => {
		const pid = projectId;
		if (!pid) return;

		const supabase = createClient();
		const channel = supabase.channel(`reports-live-${pid}`);
		(channel as any)
			.on(
				'postgres_changes',
				{ event: '*', schema: 'public', table: 'reports', filter: `project_id=eq.${pid}` },
				(p: { eventType: string; new: Tables<'reports'> | null; old: Tables<'reports'> | null }) =>
					mergeReportPayload(p, pid)
			)
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'report_folders',
					filter: `project_id=eq.${pid}`
				},
				(p: {
					eventType: string;
					new: Tables<'report_folders'> | null;
					old: Tables<'report_folders'> | null;
				}) => mergeFolderPayload(p, pid)
			)
			.subscribe();

		return () => {
			void supabase.removeChannel(channel);
		};
	});

	let draggingReportId = $state<string | null>(null);
	let dragOverTarget = $state<string | null>(null);

	async function moveReportToFolder(reportId: string, folderId: string | null) {
		const pid = projectId;
		if (!pid) return;
		clientError = '';
		const prev = reports.map((r) => ({ ...r }));
		reports = reports.map((r) => (r.id === reportId ? { ...r, folder_id: folderId } : r));
		const supabase = createClient();
		const { error } = await supabase
			.from('reports')
			.update({ folder_id: folderId })
			.eq('id', reportId)
			.eq('project_id', pid);
		if (error) {
			reports = prev;
			clientError = error.message;
		}
	}

	function onReportDragStart(e: DragEvent, reportId: string) {
		draggingReportId = reportId;
		e.dataTransfer?.setData('application/x-mint-report', reportId);
		e.dataTransfer!.effectAllowed = 'move';
	}

	function onReportDragEnd() {
		draggingReportId = null;
		dragOverTarget = null;
	}

	function allowDrop(e: DragEvent) {
		e.preventDefault();
	}

	function setDragOver(target: string | null) {
		dragOverTarget = target;
	}

	async function onDropZone(e: DragEvent, folderId: string | null) {
		e.preventDefault();
		const id =
			e.dataTransfer?.getData('application/x-mint-report')?.trim() || draggingReportId || '';
		dragOverTarget = null;
		draggingReportId = null;
		if (!id) return;
		await moveReportToFolder(id, folderId);
	}

	function toggleFolderExpand(fid: string) {
		expandedFolders = { ...expandedFolders, [fid]: !expandedFolders[fid] };
	}

	let activeReport = $state<Tables<'reports'> | null>(null);
	let editMode = $state(false);
	let editTitle = $state('');
	let editContent = $state('');
	let saving = $state(false);
	let saveError = $state('');
	let dirty = $state(false);

	let mobileSidebarOpen = $state(true);

	let newOpen = $state(false);
	let newTitle = $state('');
	let newSubmitting = $state(false);
	let newError = $state('');
	let pendingReportFolderId = $state<string | null>(null);

	let deleteTarget = $state<Tables<'reports'> | null>(null);
	let deleteSubmitting = $state(false);

	let newFolderOpen = $state(false);
	let newFolderName = $state('');
	let newFolderIcon = $state('');
	let newFolderBusy = $state(false);
	let newFolderError = $state('');

	let editFolderTarget = $state<Tables<'report_folders'> | null>(null);
	let editFolderName = $state('');
	let editFolderIcon = $state('');
	let editFolderBusy = $state(false);
	let editFolderError = $state('');

	let deleteFolderTarget = $state<Tables<'report_folders'> | null>(null);
	let deleteFolderBusy = $state(false);

	function timeAgo(d: string) {
		const diff = Date.now() - new Date(d).getTime();
		const m = Math.floor(diff / 60000);
		if (m < 60) return `${m}m ago`;
		const h = Math.floor(m / 60);
		if (h < 24) return `${h}h ago`;
		return `${Math.floor(h / 24)}d ago`;
	}

	function openReport(r: Tables<'reports'>) {
		if (dirty && activeReport) {
			if (!confirm('You have unsaved changes. Discard them?')) return;
		}
		activeReport = r;
		editTitle = r.title;
		editContent = r.content ?? '';
		editMode = false;
		dirty = false;
		saveError = '';
		mobileSidebarOpen = false;
	}

	function startEdit() {
		editMode = true;
	}

	function onContentChange(e: Event) {
		editContent = (e.target as HTMLTextAreaElement).value;
		dirty = true;
	}

	function onTitleChange(e: Event) {
		editTitle = (e.target as HTMLInputElement).value;
		dirty = true;
	}

	const rendered = $derived(
		editContent
			? (marked.parse(editContent) as string)
			: '<p class="italic" style="color:var(--color-muted-foreground)">Nothing here yet — switch to Edit to start writing.</p>'
	);

	async function saveReport() {
		if (!activeReport) return;
		saving = true;
		saveError = '';
		const body = new URLSearchParams({
			id: activeReport.id,
			title: editTitle,
			content: editContent
		});
		const res = await fetch('?/update', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: body.toString()
		});
		saving = false;
		if (res.ok) {
			dirty = false;
			activeReport = { ...activeReport, title: editTitle, content: editContent };
			reports = reports.map((r) =>
				r.id === activeReport!.id ? { ...r, title: editTitle, content: editContent } : r
			);
			editMode = false;
		} else {
			saveError = 'Failed to save. Try again.';
		}
	}

	function downloadMd() {
		if (!activeReport) return;
		const blob = new Blob([`# ${editTitle}\n\n${editContent}`], { type: 'text/markdown' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${editTitle.replace(/\s+/g, '-').toLowerCase()}.md`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function printPdf() {
		if (!activeReport) return;
		const win = window.open('', '_blank')!;
		win.document.write(`<!DOCTYPE html><html><head>
			<title>${editTitle}</title>
			<style>
				body{font-family:system-ui,sans-serif;max-width:800px;margin:2rem auto;color:#111;line-height:1.6}
				h1,h2,h3{margin-top:1.5em}
				pre{background:#f4f4f4;padding:1em;border-radius:4px;overflow-x:auto}
				code{background:#f4f4f4;padding:.2em .4em;border-radius:3px}
				blockquote{border-left:4px solid #ddd;margin:0;padding-left:1em;color:#555}
			</style>
		</head><body><h1>${editTitle}</h1>${marked.parse(editContent) as string}</body></html>`);
		win.document.close();
		win.focus();
		win.print();
	}

	function openNew(folderId: string | null = null) {
		newTitle = '';
		newError = '';
		pendingReportFolderId = folderId;
		newOpen = true;
	}

	function openNewFolderModal() {
		newFolderName = '';
		newFolderIcon = '';
		newFolderError = '';
		newFolderOpen = true;
	}

	async function submitNewFolder() {
		const pid = projectId;
		if (!pid) return;
		const name = newFolderName.trim();
		if (!name) {
			newFolderError = 'Name is required';
			return;
		}
		newFolderBusy = true;
		newFolderError = '';
		const nextSort =
			folders.length === 0 ? 0 : Math.max(...folders.map((f) => f.sort_order), 0) + 1;
		const supabase = createClient();
		const { data: row, error } = await supabase
			.from('report_folders')
			.insert({
				project_id: pid,
				name,
				icon: newFolderIcon.trim(),
				sort_order: nextSort
			})
			.select()
			.single();
		newFolderBusy = false;
		if (error) {
			newFolderError = error.message;
			return;
		}
		if (row && !folders.some((f) => f.id === row.id)) {
			folders = [...folders, row].sort((a, b) =>
				a.sort_order !== b.sort_order ? a.sort_order - b.sort_order : a.name.localeCompare(b.name)
			);
		}
		newFolderOpen = false;
	}

	function openEditFolder(f: Tables<'report_folders'>) {
		editFolderTarget = f;
		editFolderName = f.name;
		editFolderIcon = f.icon ?? '';
		editFolderError = '';
	}

	async function saveEditFolder() {
		if (!editFolderTarget) return;
		const pid = projectId;
		if (!pid) return;
		const name = editFolderName.trim();
		if (!name) {
			editFolderError = 'Name is required';
			return;
		}
		editFolderBusy = true;
		editFolderError = '';
		const id = editFolderTarget.id;
		const icon = editFolderIcon.trim();
		const supabase = createClient();
		const { error } = await supabase
			.from('report_folders')
			.update({ name, icon })
			.eq('id', id)
			.eq('project_id', pid);
		editFolderBusy = false;
		if (error) {
			editFolderError = error.message;
			return;
		}
		folders = folders.map((f) => (f.id === id ? { ...f, name, icon } : f));
		editFolderTarget = null;
	}

	async function confirmDeleteFolder() {
		if (!deleteFolderTarget) return;
		const pid = projectId;
		if (!pid) return;
		const fid = deleteFolderTarget.id;
		const snapFolders = [...folders];
		const snapReports = [...reports];
		folders = folders.filter((f) => f.id !== fid);
		reports = reports.filter((r) => r.folder_id !== fid);
		deleteFolderBusy = true;
		const supabase = createClient();
		const { error } = await supabase.from('report_folders').delete().eq('id', fid).eq('project_id', pid);
		deleteFolderBusy = false;
		if (error) {
			folders = snapFolders;
			reports = snapReports;
			clientError = error.message;
			return;
		}
		if (activeReport?.folder_id === fid) {
			activeReport = null;
			editMode = false;
			dirty = false;
			mobileSidebarOpen = true;
		}
		deleteFolderTarget = null;
	}
</script>

<div class="absolute inset-0 flex flex-col overflow-hidden">
	<div class="flex shrink-0 items-center gap-2 border-b border-border bg-card px-3 py-2 sm:hidden">
		<button
			onclick={() => (mobileSidebarOpen = !mobileSidebarOpen)}
			class="flex items-center gap-2 rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
			aria-label="Toggle reports list"
		>
			{#if mobileSidebarOpen}<X size={20} />{:else}<Menu size={20} />{/if}
		</button>
		<span class="flex-1 truncate text-base font-semibold text-foreground">
			{activeReport ? editTitle : 'Reports'}
		</span>
		{#if activeReport}
			<button onclick={downloadMd} title="Download .md" class="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"><Download size={18} /></button>
			<button onclick={printPdf} title="Print / PDF" class="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"><FileText size={18} /></button>
			{#if editMode}
				<button onclick={saveReport} disabled={saving} class="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
					{#if saving}<Loader size={14} class="animate-spin" />{:else}<Save size={14} />Save{/if}
				</button>
				<button onclick={() => (editMode = false)} class="rounded-lg bg-secondary px-3 py-1.5 text-sm text-foreground hover:bg-accent"><Eye size={14} /></button>
			{:else}
				<button onclick={startEdit} class="rounded-lg bg-secondary px-3 py-1.5 text-sm text-foreground hover:bg-accent"><Code2 size={14} /></button>
			{/if}
		{/if}
	</div>

	<div class="flex min-h-0 flex-1 overflow-hidden">
		<div
			class="flex min-h-0 max-w-full shrink-0 overflow-hidden {mobileSidebarOpen ? 'flex' : 'hidden'} sm:flex sm:w-auto"
		>
			<aside
				class="flex min-h-0 flex-1 flex-col overflow-hidden border-r border-border bg-card sm:w-auto sm:flex-none sm:shrink-0 w-full sm:min-w-[12.5rem]"
				style:width={mqlDesktop ? `${clampSidebarWidth(sidebarWidthPx)}px` : undefined}
			>
			<div class="flex items-center justify-between gap-2 border-b border-border px-4 py-4">
				<span class="text-base font-semibold text-foreground">Reports</span>
				<div class="flex shrink-0 items-center gap-1">
					<button
						type="button"
						onclick={() => openNew(null)}
						class="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 sm:px-3 sm:text-sm"
					>
						<Plus size={14} /> <span class="hidden sm:inline">New</span>
					</button>
					<button
						type="button"
						onclick={openNewFolderModal}
						title="New folder"
						class="rounded-lg border border-border bg-secondary p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
					>
						<FolderPlus size={16} />
					</button>
				</div>
			</div>

			{#if clientError}
				<p class="border-b border-border px-4 py-2 text-xs text-red-400">{clientError}</p>
			{/if}

			{#if newOpen}
				<form
					method="POST"
					action="?/create"
					use:enhance={({ formData }) => {
						newSubmitting = true;
						newError = '';
						formData.set('content', '');
						formData.set('folder_id', pendingReportFolderId ?? '');
						return async ({ result }) => {
							newSubmitting = false;
							if (result.type === 'failure') {
								newError = (result.data as { error?: string })?.error ?? 'Error';
							} else {
								newOpen = false;
								pendingReportFolderId = null;
								await invalidateAll();
								if (result.type === 'success' && (result.data as { report?: Tables<'reports'> })?.report) {
									const newId = (result.data as { report: Tables<'reports'> }).report.id;
									const found = reports.find((r) => r.id === newId);
									if (found) openReport(found);
								}
							}
						};
					}}
					class="border-b border-border p-3"
				>
					{#if pendingReportFolderId}
						<p class="mb-2 text-xs text-muted-foreground">
							New report in folder
						</p>
					{/if}
					{#if newError}<p class="mb-2 text-sm text-red-400">{newError}</p>{/if}
					<input
						name="title"
						bind:value={newTitle}
						placeholder="Report title…"
						required
						class="w-full rounded-lg border border-input bg-background px-3 py-2 text-base text-foreground"
					/>
					<div class="mt-2 flex gap-2">
						<button type="submit" disabled={newSubmitting} class="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60">
							{#if newSubmitting}<Loader size={14} class="animate-spin" />{:else}Create{/if}
						</button>
						<button type="button" onclick={() => { newOpen = false; pendingReportFolderId = null; }} class="rounded-lg bg-secondary px-3 py-2 text-sm text-foreground hover:bg-accent">
							<X size={15} />
						</button>
					</div>
				</form>
			{/if}

			<div class="flex-1 overflow-y-auto pb-4">
				<!-- Uncategorized drop zone -->
				<div
					role="region"
					aria-label="Reports without folder"
					ondragover={allowDrop}
					ondragenter={() => setDragOver('root')}
					ondragleave={(e) => {
						const root = e.currentTarget;
						if (e.relatedTarget instanceof Node && root.contains(e.relatedTarget)) return;
						if (dragOverTarget === 'root') setDragOver(null);
					}}
					ondrop={(e) => onDropZone(e, null)}
					class="border-b border-border/80 transition-colors {dragOverTarget === 'root'
						? 'bg-primary/15 ring-1 ring-inset ring-primary/40'
						: ''}"
				>
					<div class="flex items-center justify-between px-4 py-2">
						<span class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Uncategorized</span>
						<button
							type="button"
							onclick={() => openNew(null)}
							class="text-xs font-medium text-primary hover:underline"
						>
							+ Report
						</button>
					</div>
					{#if uncategorizedList().length === 0}
						<p class="px-4 pb-3 text-xs text-muted-foreground">Drag reports here to remove from folders.</p>
					{:else}
						{#each uncategorizedList() as r (r.id)}
							<div
								class="group flex items-stretch gap-0 border-b border-border/40 hover:bg-secondary/40 {activeReport?.id === r.id
									? 'bg-secondary'
									: ''}"
							>
								<button
									type="button"
									class="hidden shrink-0 cursor-grab touch-none items-center px-1 text-muted-foreground hover:text-foreground active:cursor-grabbing sm:flex"
									aria-label="Drag to folder"
									draggable="true"
									ondragstart={(e) => onReportDragStart(e, r.id)}
									ondragend={onReportDragEnd}
								>
									<GripVertical size={14} />
								</button>
								<button
									type="button"
									onclick={() => openReport(r)}
									class="min-w-0 flex-1 px-3 py-3 text-left"
								>
									<span class="block truncate text-sm font-semibold text-foreground">{r.title}</span>
									<span class="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
										<Clock size={11} />{timeAgo(r.updated_at)}
									</span>
								</button>
								<div class="flex shrink-0 flex-col justify-center gap-1 pr-2">
									<select
										value={r.folder_id ?? ''}
										onchange={(e) => {
											const v = (e.currentTarget as HTMLSelectElement).value;
											void moveReportToFolder(r.id, v ? v : null);
										}}
										class="sm:hidden rounded border border-input bg-background px-1 py-1 text-[10px] text-foreground"
										aria-label="Move to folder"
									>
										<option value="">Uncategorized</option>
										{#each sortedFolders as f}
											<option value={f.id}>{f.name}</option>
										{/each}
									</select>
									<button
										type="button"
										onclick={(e) => {
											e.stopPropagation();
											deleteTarget = r;
										}}
										class="rounded p-1 text-muted-foreground opacity-70 hover:text-red-400 group-hover:opacity-100"
										aria-label="Delete"
									>
										<Trash2 size={13} />
									</button>
								</div>
							</div>
						{/each}
					{/if}
				</div>

				{#each sortedFolders as folder (folder.id)}
					<div class="border-b border-border/80">
						<div
							role="region"
							aria-label={`Drop reports into folder ${folder.name}`}
							ondragover={allowDrop}
							ondragenter={() => setDragOver(folder.id)}
							ondragleave={(e) => {
								const root = e.currentTarget;
								if (e.relatedTarget instanceof Node && root.contains(e.relatedTarget)) return;
								if (dragOverTarget === folder.id) setDragOver(null);
							}}
							ondrop={(e) => onDropZone(e, folder.id)}
							class="flex items-center gap-1 px-2 py-2 transition-colors {dragOverTarget === folder.id
								? 'bg-primary/15 ring-1 ring-inset ring-primary/40'
								: ''}"
						>
							<button
								type="button"
								onclick={() => toggleFolderExpand(folder.id)}
								class="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
								aria-expanded={expandedFolders[folder.id]}
							>
								{#if expandedFolders[folder.id]}
									<ChevronDown size={16} />
								{:else}
									<ChevronRight size={16} />
								{/if}
							</button>
							{#if folderIconEl(folder.icon)}
								<span class="text-base leading-none" aria-hidden="true">{folderIconEl(folder.icon)}</span>
							{:else}
								<Folder size={16} class="shrink-0 text-muted-foreground" />
							{/if}
							<span class="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{folder.name}</span>
							<span class="text-xs tabular-nums text-muted-foreground">{reportsInFolder(folder.id).length}</span>
							<button
								type="button"
								onclick={(e) => {
									e.stopPropagation();
									openNew(folder.id);
								}}
								class="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-primary"
								title="New report in folder"
							>
								<Plus size={14} />
							</button>
							<button
								type="button"
								onclick={(e) => {
									e.stopPropagation();
									openEditFolder(folder);
								}}
								class="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
								title="Rename / icon"
							>
								<Pencil size={14} />
							</button>
							<button
								type="button"
								onclick={(e) => {
									e.stopPropagation();
									deleteFolderTarget = folder;
								}}
								class="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-red-400"
								title="Delete folder"
							>
								<Trash2 size={14} />
							</button>
						</div>

						{#if expandedFolders[folder.id]}
							{#if reportsInFolder(folder.id).length === 0}
								<p class="px-4 pb-3 text-xs text-muted-foreground">Empty — drag reports here or create one.</p>
							{:else}
								{#each reportsInFolder(folder.id) as r (r.id)}
									<div
										class="group flex items-stretch gap-0 border-b border-border/40 hover:bg-secondary/40 {activeReport?.id === r.id
											? 'bg-secondary'
											: ''}"
									>
										<button
											type="button"
											class="hidden shrink-0 cursor-grab touch-none items-center px-1 text-muted-foreground hover:text-foreground active:cursor-grabbing sm:flex"
											aria-label="Drag to reorganize"
											draggable="true"
											ondragstart={(e) => onReportDragStart(e, r.id)}
											ondragend={onReportDragEnd}
										>
											<GripVertical size={14} />
										</button>
										<button type="button" onclick={() => openReport(r)} class="min-w-0 flex-1 px-3 py-3 pl-2 text-left sm:pl-3">
											<span class="block truncate text-sm font-semibold text-foreground">{r.title}</span>
											<span class="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
												<Clock size={11} />{timeAgo(r.updated_at)}
											</span>
										</button>
										<div class="flex shrink-0 flex-col justify-center gap-1 pr-2">
											<select
												value={r.folder_id ?? ''}
												onchange={(e) => {
													const v = (e.currentTarget as HTMLSelectElement).value;
													void moveReportToFolder(r.id, v ? v : null);
												}}
												class="sm:hidden rounded border border-input bg-background px-1 py-1 text-[10px] text-foreground"
												aria-label="Move to folder"
											>
												<option value="">Uncategorized</option>
												{#each sortedFolders as f}
													<option value={f.id}>{f.name}</option>
												{/each}
											</select>
											<button
												type="button"
												onclick={(e) => {
													e.stopPropagation();
													deleteTarget = r;
												}}
												class="rounded p-1 text-muted-foreground opacity-70 hover:text-red-400 group-hover:opacity-100"
												aria-label="Delete"
											>
												<Trash2 size={13} />
											</button>
										</div>
									</div>
								{/each}
							{/if}
						{/if}
					</div>
				{/each}

				{#if sortedFolders.length === 0 && uncategorizedList().length === 0 && !newOpen}
					<div class="p-4 text-center text-sm text-muted-foreground">No reports yet.</div>
				{/if}
			</div>
			</aside>

			<button
				type="button"
				aria-label="Resize reports sidebar"
				tabindex="-1"
				onmousedown={onSidebarResizePointerDown}
				class="hidden shrink-0 cursor-col-resize touch-none border-0 border-l border-border bg-border/60 p-0 hover:bg-primary/35 active:bg-primary/45 sm:block sm:w-1.5"
			></button>
		</div>

		<div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden {mobileSidebarOpen ? 'hidden sm:flex' : 'flex'}">
			{#if !activeReport}
				<div class="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
					<BookOpen size={48} class="opacity-20" />
					<p class="px-4 text-center text-lg font-medium">Select a report or create a new one</p>
				</div>
			{:else}
				<div class="hidden shrink-0 items-center justify-between border-b border-border bg-card px-4 py-3 sm:flex">
					{#if editMode}
						<input
							value={editTitle}
							oninput={onTitleChange}
							class="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-lg font-bold text-foreground"
						/>
					{:else}
						<h2 class="flex-1 truncate text-xl font-bold text-foreground">{editTitle}</h2>
					{/if}

					<div class="ml-4 flex flex-wrap items-center gap-2">
						{#if saveError}<span class="text-sm text-red-400">{saveError}</span>{/if}

						{#if editMode}
							<button onclick={saveReport} disabled={saving} class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
								{#if saving}<Loader size={15} class="animate-spin" />Saving…{:else}<Save size={15} />Save{/if}
							</button>
							<button onclick={() => (editMode = false)} class="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
								<Eye size={15} /> Preview
							</button>
						{:else}
							<button onclick={startEdit} class="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
								<Code2 size={15} /> Edit
							</button>
						{/if}

						<button onclick={downloadMd} title="Download .md" class="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-foreground hover:bg-accent">
							<Download size={15} />.md
						</button>
						<button onclick={printPdf} title="Print / PDF" class="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-foreground hover:bg-accent">
							<FileText size={15} />PDF
						</button>
					</div>
				</div>

				{#if editMode}
					<div class="shrink-0 border-b border-border px-3 py-2 sm:hidden">
						<input
							value={editTitle}
							oninput={onTitleChange}
							class="w-full rounded-lg border border-input bg-background px-3 py-2 text-base font-bold text-foreground"
						/>
					</div>
				{/if}

				<div class="flex-1 overflow-y-auto">
					{#if editMode}
						<textarea
							value={editContent}
							oninput={onContentChange}
							spellcheck={false}
							placeholder="Write in Markdown…&#10;&#10;# Heading&#10;**bold**, *italic*, `code`&#10;&#10;- list item"
							class="h-full min-h-[12rem] w-full resize-none bg-background px-4 py-4 font-mono text-base text-foreground focus:outline-none sm:min-h-0 sm:px-6 sm:py-6"
						></textarea>
					{:else}
						<div
							class="prose prose-invert max-w-none px-4 py-4 sm:px-8 sm:py-8
								prose-headings:text-foreground prose-headings:font-bold
								prose-p:text-foreground prose-p:leading-relaxed
								prose-a:text-primary prose-a:no-underline hover:prose-a:underline
								prose-strong:text-foreground
								prose-code:text-primary prose-code:bg-secondary prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-code:before:content-none prose-code:after:content-none
								prose-pre:bg-secondary prose-pre:border prose-pre:border-border prose-pre:rounded-xl
								prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground
								prose-li:text-foreground prose-hr:border-border"
						>
							{@html rendered}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</div>

{#if deleteTarget}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
		<div class="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
			<h3 class="text-xl font-semibold text-foreground">Delete Report</h3>
			<p class="mt-2 text-base text-foreground">Delete <strong>{deleteTarget.title}</strong>?</p>
			<p class="mt-1 text-sm text-muted-foreground">This cannot be undone.</p>
			<form
				method="POST"
				action="?/delete"
				use:enhance={() => {
					deleteSubmitting = true;
					return async ({ result }) => {
						deleteSubmitting = false;
						if (result.type !== 'failure') {
							if (activeReport?.id === deleteTarget!.id) {
								activeReport = null;
								editMode = false;
								dirty = false;
								mobileSidebarOpen = true;
							}
							reports = reports.filter((r) => r.id !== deleteTarget!.id);
							deleteTarget = null;
							await invalidateAll();
						}
					};
				}}
			>
				<input type="hidden" name="id" value={deleteTarget.id} />
				<input type="hidden" name="title" value={deleteTarget.title} />
				<div class="mt-6 flex gap-3">
					<button type="submit" disabled={deleteSubmitting} class="flex items-center gap-2 rounded-lg bg-destructive px-6 py-3 text-base font-semibold text-white hover:bg-destructive/90 disabled:opacity-60">
						{#if deleteSubmitting}<Loader size={18} class="animate-spin" />Deleting…{:else}<Trash2 size={18} />Delete{/if}
					</button>
					<button type="button" onclick={() => (deleteTarget = null)} class="rounded-lg bg-secondary px-6 py-3 text-base font-medium text-foreground hover:bg-accent">Cancel</button>
				</div>
			</form>
		</div>
	</div>
{/if}

{#if newFolderOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
		<div class="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
			<h3 class="text-xl font-semibold text-foreground">New folder</h3>
			{#if newFolderError}<p class="mt-2 text-sm text-red-400">{newFolderError}</p>{/if}
			<input
				bind:value={newFolderName}
				placeholder="Folder name"
				class="mt-4 w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground"
			/>
			<p class="mt-3 text-xs font-medium uppercase text-muted-foreground">Icon</p>
			<div class="mt-2 flex flex-wrap gap-2">
				{#each FOLDER_ICON_CHOICES as ic}
					<button
						type="button"
						onclick={() => (newFolderIcon = ic)}
						class="rounded-lg border px-2 py-1 text-lg transition-colors {newFolderIcon === ic ? 'border-primary bg-primary/20' : 'border-border bg-secondary hover:bg-accent'}"
					>
						{#if ic.trim()}
							{ic}
						{:else}
							<Folder size={18} class="mx-auto text-muted-foreground" />
						{/if}
					</button>
				{/each}
			</div>
			<div class="mt-6 flex gap-3">
				<button type="button" disabled={newFolderBusy} onclick={submitNewFolder} class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-60">
					{#if newFolderBusy}<Loader size={18} class="animate-spin" />{:else}Create{/if}
				</button>
				<button type="button" onclick={() => (newFolderOpen = false)} class="rounded-lg bg-secondary px-4 py-3 font-medium text-foreground hover:bg-accent">Cancel</button>
			</div>
		</div>
	</div>
{/if}

{#if editFolderTarget}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
		<div class="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
			<h3 class="text-xl font-semibold text-foreground">Folder</h3>
			{#if editFolderError}<p class="mt-2 text-sm text-red-400">{editFolderError}</p>{/if}
			<input
				bind:value={editFolderName}
				placeholder="Folder name"
				class="mt-4 w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground"
			/>
			<p class="mt-3 text-xs font-medium uppercase text-muted-foreground">Icon</p>
			<div class="mt-2 flex flex-wrap gap-2">
				{#each FOLDER_ICON_CHOICES as ic}
					<button
						type="button"
						onclick={() => (editFolderIcon = ic)}
						class="rounded-lg border px-2 py-1 text-lg transition-colors {editFolderIcon === ic ? 'border-primary bg-primary/20' : 'border-border bg-secondary hover:bg-accent'}"
					>
						{#if ic.trim()}
							{ic}
						{:else}
							<Folder size={18} class="mx-auto text-muted-foreground" />
						{/if}
					</button>
				{/each}
			</div>
			<div class="mt-6 flex gap-3">
				<button type="button" disabled={editFolderBusy} onclick={saveEditFolder} class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground disabled:opacity-60">
					{#if editFolderBusy}<Loader size={18} class="animate-spin" />{:else}Save{/if}
				</button>
				<button type="button" onclick={() => (editFolderTarget = null)} class="rounded-lg bg-secondary px-4 py-3 font-medium text-foreground hover:bg-accent">Cancel</button>
			</div>
		</div>
	</div>
{/if}

{#if deleteFolderTarget}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
		<div class="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
			<h3 class="text-xl font-semibold text-foreground">Delete folder</h3>
			<p class="mt-2 text-base text-foreground">
				Delete <strong>{deleteFolderTarget.name}</strong> and every report inside it?
			</p>
			<p class="mt-1 text-sm text-muted-foreground">
				This removes <strong>{reportsInFolder(deleteFolderTarget.id).length}</strong> report(s). Cannot be undone.
			</p>
			<div class="mt-6 flex gap-3">
				<button type="button" disabled={deleteFolderBusy} onclick={confirmDeleteFolder} class="flex items-center gap-2 rounded-lg bg-destructive px-6 py-3 text-base font-semibold text-white hover:bg-destructive/90 disabled:opacity-60">
					{#if deleteFolderBusy}<Loader size={18} class="animate-spin" />{:else}<Trash2 size={18} />Delete{/if}
				</button>
				<button type="button" onclick={() => (deleteFolderTarget = null)} class="rounded-lg bg-secondary px-6 py-3 text-base font-medium text-foreground hover:bg-accent">Cancel</button>
			</div>
		</div>
	</div>
{/if}

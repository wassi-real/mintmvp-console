<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import {
		BookOpen, Plus, Trash2, Eye, Code2,
		Download, FileText, Loader, X, Save, Clock, Menu
	} from 'lucide-svelte';
	import { marked } from 'marked';

	let { data } = $props();

	// ── State ──────────────────────────────────────────────
	let reports: any[] = $state([]);
	$effect(() => { reports = [...data.reports]; });

	let activeReport  = $state<any>(null);
	let editMode      = $state(false);
	let editTitle     = $state('');
	let editContent   = $state('');
	let saving        = $state(false);
	let saveError     = $state('');
	let dirty         = $state(false);

	// mobile sidebar visibility
	let mobileSidebarOpen = $state(true); // start open so user sees the list first

	// new report form
	let newOpen       = $state(false);
	let newTitle      = $state('');
	let newSubmitting = $state(false);
	let newError      = $state('');

	// delete confirm
	let deleteTarget    = $state<any>(null);
	let deleteSubmitting = $state(false);

	// ── Helpers ─────────────────────────────────────────────
	function timeAgo(d: string) {
		const diff = Date.now() - new Date(d).getTime();
		const m = Math.floor(diff / 60000);
		if (m < 60) return `${m}m ago`;
		const h = Math.floor(m / 60);
		if (h < 24) return `${h}h ago`;
		return `${Math.floor(h / 24)}d ago`;
	}

	function openReport(r: any) {
		if (dirty && activeReport) {
			if (!confirm('You have unsaved changes. Discard them?')) return;
		}
		activeReport = r;
		editTitle    = r.title;
		editContent  = r.content ?? '';
		editMode     = false;
		dirty        = false;
		saveError    = '';
		// On mobile, hide the sidebar after selecting a report
		mobileSidebarOpen = false;
	}

	function startEdit() { editMode = true; }

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

	// ── Save ────────────────────────────────────────────────
	async function saveReport() {
		if (!activeReport) return;
		saving = true; saveError = '';
		const body = new URLSearchParams({ id: activeReport.id, title: editTitle, content: editContent });
		const res = await fetch('?/update', {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: body.toString()
		});
		saving = false;
		if (res.ok) {
			dirty = false;
			activeReport = { ...activeReport, title: editTitle, content: editContent };
			reports = reports.map(r => r.id === activeReport.id ? { ...r, title: editTitle, content: editContent } : r);
			editMode = false;
		} else {
			saveError = 'Failed to save. Try again.';
		}
	}

	// ── Export ──────────────────────────────────────────────
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
		win.document.close(); win.focus(); win.print();
	}

	function openNew() { newTitle = ''; newError = ''; newOpen = true; }
</script>

<!-- Root: fills the absolute-positioned content area -->
<div class="absolute inset-0 flex flex-col overflow-hidden">

	<!-- ── Mobile top bar ────────────────────────────────── -->
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

	<!-- ── Main two-column area ──────────────────────────── -->
	<div class="flex flex-1 overflow-hidden">

		<!-- ── Reports list sidebar ──────────────────────── -->
		<!-- Desktop: always visible | Mobile: toggle -->
		<aside class="
			flex shrink-0 flex-col border-r border-border bg-card overflow-hidden
			w-full sm:w-64
			{mobileSidebarOpen ? 'flex' : 'hidden'} sm:flex
		">
			<!-- Sidebar header -->
			<div class="flex items-center justify-between border-b border-border px-4 py-4">
				<span class="text-base font-semibold text-foreground">Reports</span>
				<button
					onclick={openNew}
					class="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
				>
					<Plus size={15} /> New
				</button>
			</div>

			<!-- Inline create form -->
			{#if newOpen}
				<form
					method="POST"
					action="?/create"
					use:enhance={({ formData }) => {
						newSubmitting = true; newError = '';
						formData.set('content', '');
						return async ({ result }) => {
							newSubmitting = false;
							if (result.type === 'failure') {
								newError = (result.data as any)?.error ?? 'Error';
							} else {
								newOpen = false;
								await invalidateAll();
								if (result.type === 'success' && (result.data as any)?.report) {
									const newId = (result.data as any).report.id;
									const found = reports.find(r => r.id === newId);
									if (found) openReport(found);
								}
							}
						};
					}}
					class="border-b border-border p-3"
				>
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
						<button type="button" onclick={() => (newOpen = false)} class="rounded-lg bg-secondary px-3 py-2 text-sm text-foreground hover:bg-accent">
							<X size={15} />
						</button>
					</div>
				</form>
			{/if}

			<!-- Report list -->
			<div class="flex-1 overflow-y-auto">
				{#if reports.length === 0}
					<div class="p-4 text-center text-sm text-muted-foreground">No reports yet.</div>
				{:else}
					{#each reports as r}
						<div
							role="button"
							tabindex="0"
							onkeydown={(e) => e.key === 'Enter' && openReport(r)}
							onclick={() => openReport(r)}
							class="group flex w-full cursor-pointer flex-col items-start gap-0.5 border-b border-border/50 px-4 py-3 text-left transition-colors hover:bg-secondary/40 {activeReport?.id === r.id ? 'bg-secondary' : ''}"
						>
							<span class="w-full truncate text-sm font-semibold text-foreground">{r.title}</span>
							<div class="flex w-full items-center justify-between">
								<span class="flex items-center gap-1 text-xs text-muted-foreground">
									<Clock size={11} />{timeAgo(r.updated_at)}
								</span>
								<button
									onclick={(e) => { e.stopPropagation(); deleteTarget = r; }}
									class="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-400"
									aria-label="Delete"
								>
									<Trash2 size={13} />
								</button>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</aside>

		<!-- ── Editor / Preview pane ─────────────────────── -->
		<!-- On mobile: hidden when sidebar is open -->
		<div class="flex flex-1 flex-col overflow-hidden {mobileSidebarOpen ? 'hidden sm:flex' : 'flex'}">
			{#if !activeReport}
				<div class="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
					<BookOpen size={48} class="opacity-20" />
					<p class="text-center text-lg font-medium px-4">Select a report or create a new one</p>
				</div>
			{:else}
				<!-- Desktop toolbar (hidden on mobile — handled by top bar above) -->
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
							<button onclick={saveReport} disabled={saving}
								class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
								{#if saving}<Loader size={15} class="animate-spin" />Saving…{:else}<Save size={15} />Save{/if}
							</button>
							<button onclick={() => (editMode = false)}
								class="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
								<Eye size={15} /> Preview
							</button>
						{:else}
							<button onclick={startEdit}
								class="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-accent">
								<Code2 size={15} /> Edit
							</button>
						{/if}

						<button onclick={downloadMd} title="Download .md"
							class="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-foreground hover:bg-accent">
							<Download size={15} />.md
						</button>
						<button onclick={printPdf} title="Print / PDF"
							class="flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-foreground hover:bg-accent">
							<FileText size={15} />PDF
						</button>
					</div>
				</div>

				<!-- Mobile title bar when editing (shows inside editor pane) -->
				{#if editMode}
					<div class="shrink-0 border-b border-border px-3 py-2 sm:hidden">
						<input
							value={editTitle}
							oninput={onTitleChange}
							class="w-full rounded-lg border border-input bg-background px-3 py-2 text-base font-bold text-foreground"
						/>
					</div>
				{/if}

				<!-- Content -->
				<div class="flex-1 overflow-y-auto">
					{#if editMode}
						<textarea
							value={editContent}
							oninput={onContentChange}
							spellcheck="false"
							placeholder="Write in Markdown…&#10;&#10;# Heading&#10;**bold**, *italic*, `code`&#10;&#10;- list item"
							class="h-full w-full resize-none bg-background px-4 py-4 font-mono text-base text-foreground focus:outline-none sm:px-6 sm:py-6"
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

<!-- Delete confirm modal -->
{#if deleteTarget}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
		<div class="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
			<h3 class="text-xl font-semibold text-foreground">Delete Report</h3>
			<p class="mt-2 text-base text-foreground">Delete <strong>{deleteTarget.title}</strong>?</p>
			<p class="mt-1 text-sm text-muted-foreground">This cannot be undone.</p>
			<form method="POST" action="?/delete"
				use:enhance={() => { deleteSubmitting = true;
					return async ({ result }) => {
						deleteSubmitting = false;
						if (result.type !== 'failure') {
							if (activeReport?.id === deleteTarget.id) { activeReport = null; editMode = false; dirty = false; mobileSidebarOpen = true; }
							reports = reports.filter(r => r.id !== deleteTarget.id);
							deleteTarget = null;
							await invalidateAll();
						}
					};
				}}
			>
				<input type="hidden" name="id" value={deleteTarget.id} />
				<input type="hidden" name="title" value={deleteTarget.title} />
				<div class="mt-6 flex gap-3">
					<button type="submit" disabled={deleteSubmitting}
						class="flex items-center gap-2 rounded-lg bg-destructive px-6 py-3 text-base font-semibold text-white hover:bg-destructive/90 disabled:opacity-60">
						{#if deleteSubmitting}<Loader size={18} class="animate-spin" />Deleting…{:else}<Trash2 size={18} />Delete{/if}
					</button>
					<button type="button" onclick={() => (deleteTarget = null)}
						class="rounded-lg bg-secondary px-6 py-3 text-base font-medium text-foreground hover:bg-accent">Cancel</button>
				</div>
			</form>
		</div>
	</div>
{/if}

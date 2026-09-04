<script lang="ts">
	import PageTitleBar from '$lib/components/PageTitleBar.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Markdown from '$lib/components/Markdown.svelte';
	import { FileText, Plus, ChevronDown, ChevronRight, Loader, Pencil, Trash2, List, LayoutGrid, ZoomIn, ZoomOut, Maximize2 } from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	type ViewMode = 'list' | 'board';
	let viewMode = $state<ViewMode>('list');
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

	// ─── Board state ─────────────────────────────
	let boardEl = $state<HTMLDivElement | null>(null);
	let scale = $state(1);
	let panX = $state(0);
	let panY = $state(0);
	let isPanning = $state(false);
	let panStart = $state({ x: 0, y: 0, panX: 0, panY: 0 });

	const ZOOM_STEP = 0.15;
	const MIN_ZOOM = 0.3;
	const MAX_ZOOM = 3;

	function zoomIn() { scale = Math.min(MAX_ZOOM, scale + ZOOM_STEP); }
	function zoomOut() { scale = Math.max(MIN_ZOOM, scale - ZOOM_STEP); }
	function resetView() { scale = 1; panX = 0; panY = 0; }

	function onWheel(e: WheelEvent) {
		e.preventDefault();
		const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
		scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale + delta));
	}

	function onPointerDown(e: PointerEvent) {
		if (e.button !== 0) return;
		const target = e.target as HTMLElement;
		if (target.closest('button') || target.closest('a')) return;
		isPanning = true;
		panStart = { x: e.clientX, y: e.clientY, panX, panY };
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onPointerMove(e: PointerEvent) {
		if (!isPanning) return;
		panX = panStart.panX + (e.clientX - panStart.x);
		panY = panStart.panY + (e.clientY - panStart.y);
	}

	function onPointerUp() {
		isPanning = false;
	}

	// Board expanded card
	let boardExpanded = $state<string | null>(null);
	function toggleBoardCard(id: string) {
		boardExpanded = boardExpanded === id ? null : id;
	}

	const statusOrder = ['draft', 'approved', 'in_dev', 'completed'];
	const statusLabels: Record<string, string> = { draft: 'Draft', approved: 'Approved', in_dev: 'In Dev', completed: 'Completed' };
	const statusColors: Record<string, string> = {
		draft: 'border-border',
		approved: 'border-primary/30',
		in_dev: 'border-warning/40',
		completed: 'border-success/40'
	};

	const specsByStatus = $derived(
		statusOrder.map(s => ({
			status: s,
			label: statusLabels[s],
			specs: data.specs.filter((sp: any) => sp.status === s)
		}))
	);

	const stats = $derived(
		specsByStatus.map((group) => ({
			label: group.label,
			value: group.specs.length,
			tone: group.status === 'completed' && group.specs.length > 0 ? 'text-success' : 'text-foreground'
		}))
	);

	/** The five long-form fields, in a stable order, with the empty ones dropped. */
	function specSections(spec: any, includeSummary = true) {
		const all = [
			{ label: 'Summary', value: spec.summary, wide: false },
			{ label: 'Goal', value: spec.goal, wide: false },
			{ label: 'Acceptance Criteria', value: spec.acceptance_criteria, wide: false },
			{ label: 'Edge Cases', value: spec.edge_cases, wide: false },
			{ label: 'Regression Risks', value: spec.regression_risks, wide: true }
		];
		return (includeSummary ? all : all.slice(1)).filter((s) => Boolean(s.value));
	}

	function delay(i: number) {
		return `${Math.min(i, 8) * 40}ms`;
	}

	const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground';
	const fieldClass =
		'w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40';
	const areaClass =
		'w-full rounded-lg border border-input bg-background px-3 py-2.5 font-mono text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40';
	const btnPrimary =
		'press inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60';
	const btnQuiet =
		'press inline-flex items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent';
	const btnDanger =
		'press inline-flex items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-60';
	const iconBtn =
		'press rounded-md border border-border bg-card p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground';
	const errorClass =
		'mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive';
	const sectionLabel = 'mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground';
</script>

<PageTitleBar title="Specs" description="Feature specifications">
	{#snippet meta()}
		<span class="tabular-nums">{data.specs.length} {data.specs.length === 1 ? 'spec' : 'specs'}</span>
		<span class="text-muted-foreground/40">·</span>
		<span class="tabular-nums">{stats[3].value} completed</span>
	{/snippet}
	{#snippet actions()}
		<div class="flex items-center gap-0.5 rounded-lg border border-border bg-card p-1" role="group" aria-label="Change layout">
			<button
				onclick={() => (viewMode = 'list')}
				aria-pressed={viewMode === 'list'}
				title="List view"
				class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors {viewMode === 'list' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}"
			>
				<List size={16} /> <span class="hidden sm:inline">List</span>
			</button>
			<button
				onclick={() => (viewMode = 'board')}
				aria-pressed={viewMode === 'board'}
				title="Board view"
				class="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors {viewMode === 'board' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}"
			>
				<LayoutGrid size={16} /> <span class="hidden sm:inline">Board</span>
			</button>
		</div>
		<button onclick={() => { createError = ''; createOpen = true; }} class={btnPrimary}>
			<Plus size={17} />
			<span class="hidden sm:inline">New Spec</span>
			<span class="sm:hidden">New</span>
		</button>
	{/snippet}
</PageTitleBar>

<!-- Create -->
<Modal bind:open={createOpen} title="Create Spec">
	<form method="POST" action="?/create" use:enhance={() => { createSubmitting = true; createError = '';
		return async ({ result }) => { createSubmitting = false;
			if (result.type === 'failure') createError = (result.data as any)?.error ?? 'Error';
			else { createOpen = false; await invalidateAll(); }
		};
	}}>
		{#if createError}<div class={errorClass}>{createError}</div>{/if}
		<p class="mb-4 text-xs text-muted-foreground">All text fields support <strong class="font-semibold text-foreground">Markdown</strong> — headings, lists, code blocks, bold, links.</p>
		<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
			<div>
				<label for="c-title" class={labelClass}>Title <span class="text-destructive">*</span></label>
				<input id="c-title" name="title" required class={fieldClass} placeholder="Client-facing score breakdown" />
			</div>
			<div>
				<label for="c-status" class={labelClass}>Status</label>
				<select id="c-status" name="status" class={fieldClass}>
					<option value="draft">Draft</option><option value="approved">Approved</option>
					<option value="in_dev">In Dev</option><option value="completed">Completed</option>
				</select>
			</div>
			<div class="lg:col-span-2">
				<label for="c-summary" class={labelClass}>Summary</label>
				<textarea id="c-summary" name="summary" rows="3" class={areaClass} placeholder="Supports **markdown**"></textarea>
			</div>
			<div class="lg:col-span-2">
				<label for="c-goal" class={labelClass}>Goal</label>
				<textarea id="c-goal" name="goal" rows="2" class={areaClass} placeholder="Supports **markdown**"></textarea>
			</div>
			<div>
				<label for="c-ac" class={labelClass}>Acceptance Criteria</label>
				<textarea id="c-ac" name="acceptance_criteria" rows="4" class={areaClass} placeholder="- [ ] Criterion 1&#10;- [ ] Criterion 2"></textarea>
			</div>
			<div>
				<label for="c-ec" class={labelClass}>Edge Cases</label>
				<textarea id="c-ec" name="edge_cases" rows="4" class={areaClass} placeholder="- Edge case 1&#10;- Edge case 2"></textarea>
			</div>
			<div class="lg:col-span-2">
				<label for="c-rr" class={labelClass}>Regression Risks</label>
				<textarea id="c-rr" name="regression_risks" rows="2" class={areaClass} placeholder="Supports **markdown**"></textarea>
			</div>
		</div>
		<div class="mt-6 flex flex-wrap gap-2">
			<button type="submit" disabled={createSubmitting} class={btnPrimary}>
				{#if createSubmitting}<Loader size={16} class="animate-spin" />Creating...{:else}Create Spec{/if}
			</button>
			<button type="button" onclick={() => (createOpen = false)} class={btnQuiet}>Cancel</button>
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
			{#if editError}<div class={errorClass}>{editError}</div>{/if}
			<input type="hidden" name="id" value={editItem.id} />
			<p class="mb-4 text-xs text-muted-foreground">All text fields support <strong class="font-semibold text-foreground">Markdown</strong>.</p>
			<div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<div>
					<label for="e-title" class={labelClass}>Title <span class="text-destructive">*</span></label>
					<input id="e-title" name="title" required bind:value={editItem.title} class={fieldClass} />
				</div>
				<div>
					<label for="e-status" class={labelClass}>Status</label>
					<select id="e-status" name="status" bind:value={editItem.status} class={fieldClass}>
						<option value="draft">Draft</option><option value="approved">Approved</option>
						<option value="in_dev">In Dev</option><option value="completed">Completed</option>
					</select>
				</div>
				<div class="lg:col-span-2">
					<label for="e-summary" class={labelClass}>Summary</label>
					<textarea id="e-summary" name="summary" rows="3" bind:value={editItem.summary} class={areaClass}></textarea>
				</div>
				<div class="lg:col-span-2">
					<label for="e-goal" class={labelClass}>Goal</label>
					<textarea id="e-goal" name="goal" rows="2" bind:value={editItem.goal} class={areaClass}></textarea>
				</div>
				<div>
					<label for="e-ac" class={labelClass}>Acceptance Criteria</label>
					<textarea id="e-ac" name="acceptance_criteria" rows="4" bind:value={editItem.acceptance_criteria} class={areaClass}></textarea>
				</div>
				<div>
					<label for="e-ec" class={labelClass}>Edge Cases</label>
					<textarea id="e-ec" name="edge_cases" rows="4" bind:value={editItem.edge_cases} class={areaClass}></textarea>
				</div>
				<div class="lg:col-span-2">
					<label for="e-rr" class={labelClass}>Regression Risks</label>
					<textarea id="e-rr" name="regression_risks" rows="2" bind:value={editItem.regression_risks} class={areaClass}></textarea>
				</div>
			</div>
			<div class="mt-6 flex flex-wrap gap-2">
				<button type="submit" disabled={editSubmitting} class={btnPrimary}>
					{#if editSubmitting}<Loader size={16} class="animate-spin" />Saving...{:else}Save Changes{/if}
				</button>
				<button type="button" onclick={() => (editOpen = false)} class={btnQuiet}>Cancel</button>
			</div>
		</form>
	{/if}
</Modal>

<!-- Delete -->
<Modal bind:open={deleteOpen} title="Delete Spec">
	{#if deleteItem}
		<p class="text-base text-foreground">Delete spec <strong class="font-semibold">{deleteItem.title}</strong>?</p>
		<p class="mt-1 text-sm text-muted-foreground">This cannot be undone.</p>
		<form method="POST" action="?/delete" use:enhance={() => { deleteSubmitting = true;
			return async ({ result }) => { deleteSubmitting = false;
				if (result.type !== 'failure') { deleteOpen = false; await invalidateAll(); }
			};
		}}>
			<input type="hidden" name="id" value={deleteItem.id} />
			<input type="hidden" name="title" value={deleteItem.title} />
			<div class="mt-6 flex flex-wrap gap-2">
				<button type="submit" disabled={deleteSubmitting} class={btnDanger}>
					{#if deleteSubmitting}<Loader size={16} class="animate-spin" />Deleting...{:else}<Trash2 size={16} />Delete{/if}
				</button>
				<button type="button" onclick={() => (deleteOpen = false)} class={btnQuiet}>Cancel</button>
			</div>
		</form>
	{/if}
</Modal>

{#if data.specs.length === 0}
	<EmptyState icon={FileText} title="No specs yet" description="Create your first feature specification." />
{:else}
	<!-- Status spread, grouped into a single quiet card -->
	<div
		class="rise grid grid-cols-2 gap-y-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-4 sm:gap-y-0 sm:divide-x sm:divide-border/60 sm:p-5"
	>
		{#each stats as stat (stat.label)}
			<div class="sm:px-5 sm:first:pl-0 sm:last:pr-0">
				<p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{stat.label}</p>
				<p class="mt-1 text-2xl font-bold tabular-nums leading-none {stat.tone}">{stat.value}</p>
			</div>
		{/each}
	</div>

	{#if viewMode === 'list'}
		<!-- ═══════════ LIST VIEW ═══════════ -->
		<div class="mt-4 overflow-hidden rounded-xl border border-border bg-card">
			<ul class="divide-y divide-border/60">
				{#each data.specs as spec, i (spec.id)}
					<li class="rise group" style:--delay={delay(i)}>
						<div class="row-hover flex items-center gap-2 px-3 py-2.5 sm:px-4">
							<button
								onclick={() => toggleSpec(spec.id)}
								aria-expanded={expandedSpec === spec.id}
								class="flex min-w-0 flex-1 items-center gap-2.5 text-left"
							>
								<ChevronRight
									size={15}
									class="shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none {expandedSpec === spec.id ? 'rotate-90' : ''}"
								/>
								<span class="truncate text-sm font-semibold text-foreground">{spec.title}</span>
								<StatusBadge status={spec.status} size="sm" />
							</button>

							<span class="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:inline">
								{specSections(spec).length}/5 sections
							</span>

							<div class="flex shrink-0 items-center gap-0.5 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
								<button onclick={() => openEdit(spec)} class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="Edit spec"><Pencil size={15} /></button>
								<button onclick={() => openDelete(spec)} class="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive" aria-label="Delete spec"><Trash2 size={15} /></button>
							</div>
						</div>

						{#if expandedSpec === spec.id}
							<div class="border-t border-border/60 bg-background/40 px-4 py-4 sm:px-5">
								{#if specSections(spec).length === 0}
									<p class="text-sm text-muted-foreground">No details captured yet.</p>
								{:else}
									<div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
										{#each specSections(spec) as section (section.label)}
											<div class={section.wide ? 'lg:col-span-2' : ''}>
												<p class={sectionLabel}>{section.label}</p>
												<Markdown content={section.value} />
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		</div>
	{:else}
		<!-- ═══════════ BOARD VIEW ═══════════ -->
		<div class="mt-4">
			<!-- Canvas toolbar -->
			<div class="mb-3 flex flex-wrap items-center gap-2">
				<button onclick={zoomOut} class={iconBtn} aria-label="Zoom out"><ZoomOut size={15} /></button>
				<span class="min-w-[3rem] text-center text-xs font-semibold tabular-nums text-muted-foreground">{Math.round(scale * 100)}%</span>
				<button onclick={zoomIn} class={iconBtn} aria-label="Zoom in"><ZoomIn size={15} /></button>
				<button onclick={resetView} class={iconBtn} aria-label="Reset view"><Maximize2 size={15} /></button>
				<span class="ml-1 text-xs text-muted-foreground">Scroll to zoom · drag to pan</span>
			</div>

			<!-- Board canvas -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				bind:this={boardEl}
				class="relative h-[68vh] min-h-[24rem] overflow-hidden rounded-xl border border-border bg-background {isPanning ? 'cursor-grabbing' : 'cursor-grab'}"
				onwheel={onWheel}
				onpointerdown={onPointerDown}
				onpointermove={onPointerMove}
				onpointerup={onPointerUp}
				onpointercancel={onPointerUp}
			>
				<!-- Grid dots background -->
				<div
					class="pointer-events-none absolute inset-0 opacity-[0.12]"
					style="background-image: radial-gradient(circle, var(--color-muted-foreground) 1px, transparent 1px); background-size: {24 * scale}px {24 * scale}px; background-position: {panX % (24 * scale)}px {panY % (24 * scale)}px;"
				></div>

				<!-- Transformed content -->
				<div
					class="absolute left-0 top-0 origin-top-left"
					style="transform: translate({panX}px, {panY}px) scale({scale}); will-change: transform;"
				>
					<div class="flex gap-5 p-6">
						{#each specsByStatus as group (group.status)}
							<div class="flex w-[19rem] shrink-0 flex-col">
								<!-- Column header -->
								<div class="mb-3 flex items-center gap-2.5 rounded-lg border border-border bg-card/85 px-3 py-2 backdrop-blur">
									<StatusBadge status={group.status} size="sm" />
									<span class="ml-auto rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">{group.specs.length}</span>
								</div>

								<!-- Cards -->
								<div class="flex flex-col gap-2.5">
									{#each group.specs as spec (spec.id)}
										<div class="card-hover rounded-xl border bg-card/95 backdrop-blur {statusColors[spec.status] ?? 'border-border'}">
											<!-- Card header -->
											<div class="flex items-start justify-between gap-2 px-3.5 pb-2 pt-3.5">
												<button onclick={() => toggleBoardCard(spec.id)} class="flex-1 text-left">
													<h4 class="text-sm font-semibold leading-snug text-foreground">{spec.title}</h4>
												</button>
												<div class="flex shrink-0 items-center gap-0.5">
													<button onclick={() => openEdit(spec)} class="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="Edit"><Pencil size={13} /></button>
													<button onclick={() => openDelete(spec)} class="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive" aria-label="Delete"><Trash2 size={13} /></button>
												</div>
											</div>

											<!-- Summary preview -->
											{#if spec.summary}
												<div class="px-3.5 pb-3">
													{#if boardExpanded === spec.id}
														<Markdown content={spec.summary} />
													{:else}
														<p class="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{spec.summary}</p>
													{/if}
												</div>
											{/if}

											<!-- Expanded detail -->
											{#if boardExpanded === spec.id}
												<div class="space-y-3 border-t border-border/60 px-3.5 py-3">
													{#each specSections(spec, false) as section (section.label)}
														<div>
															<p class={sectionLabel}>{section.label}</p>
															<Markdown content={section.value} />
														</div>
													{/each}
													{#if specSections(spec, false).length === 0}
														<p class="text-xs text-muted-foreground">No further detail captured.</p>
													{/if}
												</div>
											{/if}

											<!-- Footer toggle -->
											<button
												onclick={() => toggleBoardCard(spec.id)}
												aria-expanded={boardExpanded === spec.id}
												class="flex w-full items-center justify-center gap-1.5 rounded-b-xl border-t border-border/60 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground"
											>
												<ChevronDown
													size={13}
													class="transition-transform duration-200 motion-reduce:transition-none {boardExpanded === spec.id ? 'rotate-180' : ''}"
												/>
												{boardExpanded === spec.id ? 'Less' : 'More'}
											</button>
										</div>
									{/each}

									{#if group.specs.length === 0}
										<div class="rounded-xl border border-dashed border-border/60 px-3 py-7 text-center">
											<p class="text-xs text-muted-foreground">No specs</p>
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>
	{/if}
{/if}

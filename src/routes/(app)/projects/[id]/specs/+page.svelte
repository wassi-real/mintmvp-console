<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Markdown from '$lib/components/Markdown.svelte';
	import { FileText, Plus, ChevronDown, ChevronUp, Loader, Pencil, Trash2, List, LayoutGrid, ZoomIn, ZoomOut, Maximize2 } from 'lucide-svelte';
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
		draft: 'border-zinc-600/50',
		approved: 'border-blue-600/50',
		in_dev: 'border-amber-600/50',
		completed: 'border-green-600/50'
	};

	const specsByStatus = $derived(
		statusOrder.map(s => ({
			status: s,
			label: statusLabels[s],
			specs: data.specs.filter((sp: any) => sp.status === s)
		}))
	);
</script>

<div>
	<PageHeader title="Specs" description="Feature specifications">
		{#snippet actions()}
			<div class="flex items-center gap-2">
				<!-- View toggle -->
				<div class="flex rounded-lg border border-border bg-secondary/50">
					<button onclick={() => (viewMode = 'list')}
						class="flex items-center gap-1.5 rounded-l-lg px-3 py-2 text-sm font-medium transition-colors {viewMode === 'list' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}"
						aria-label="List view">
						<List size={16} /> <span class="hidden sm:inline">List</span>
					</button>
					<button onclick={() => (viewMode = 'board')}
						class="flex items-center gap-1.5 rounded-r-lg px-3 py-2 text-sm font-medium transition-colors {viewMode === 'board' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground'}"
						aria-label="Board view">
						<LayoutGrid size={16} /> <span class="hidden sm:inline">Board</span>
					</button>
				</div>
				<button onclick={() => { createError = ''; createOpen = true; }}
					class="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
					<Plus size={18} /> New Spec
				</button>
			</div>
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
			<p class="mb-4 text-xs text-muted-foreground">All text fields support <strong class="text-foreground">Markdown</strong> — use headings, lists, code blocks, bold, links, etc.</p>
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
					<textarea id="c-summary" name="summary" rows="3" class="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm font-mono text-foreground" placeholder="Supports **markdown**"></textarea>
				</div>
				<div class="lg:col-span-2">
					<label for="c-goal" class="mb-1 block text-base font-medium text-foreground">Goal</label>
					<textarea id="c-goal" name="goal" rows="2" class="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm font-mono text-foreground" placeholder="Supports **markdown**"></textarea>
				</div>
				<div>
					<label for="c-ac" class="mb-1 block text-base font-medium text-foreground">Acceptance Criteria</label>
					<textarea id="c-ac" name="acceptance_criteria" rows="4" class="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm font-mono text-foreground" placeholder="- [ ] Criterion 1&#10;- [ ] Criterion 2"></textarea>
				</div>
				<div>
					<label for="c-ec" class="mb-1 block text-base font-medium text-foreground">Edge Cases</label>
					<textarea id="c-ec" name="edge_cases" rows="4" class="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm font-mono text-foreground" placeholder="- Edge case 1&#10;- Edge case 2"></textarea>
				</div>
				<div class="lg:col-span-2">
					<label for="c-rr" class="mb-1 block text-base font-medium text-foreground">Regression Risks</label>
					<textarea id="c-rr" name="regression_risks" rows="2" class="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm font-mono text-foreground" placeholder="Supports **markdown**"></textarea>
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
				<p class="mb-4 text-xs text-muted-foreground">All text fields support <strong class="text-foreground">Markdown</strong>.</p>
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
						<textarea id="e-summary" name="summary" rows="3" bind:value={editItem.summary} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm font-mono text-foreground"></textarea>
					</div>
					<div class="lg:col-span-2">
						<label for="e-goal" class="mb-1 block text-base font-medium text-foreground">Goal</label>
						<textarea id="e-goal" name="goal" rows="2" bind:value={editItem.goal} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm font-mono text-foreground"></textarea>
					</div>
					<div>
						<label for="e-ac" class="mb-1 block text-base font-medium text-foreground">Acceptance Criteria</label>
						<textarea id="e-ac" name="acceptance_criteria" rows="4" bind:value={editItem.acceptance_criteria} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm font-mono text-foreground"></textarea>
					</div>
					<div>
						<label for="e-ec" class="mb-1 block text-base font-medium text-foreground">Edge Cases</label>
						<textarea id="e-ec" name="edge_cases" rows="4" bind:value={editItem.edge_cases} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm font-mono text-foreground"></textarea>
					</div>
					<div class="lg:col-span-2">
						<label for="e-rr" class="mb-1 block text-base font-medium text-foreground">Regression Risks</label>
						<textarea id="e-rr" name="regression_risks" rows="2" bind:value={editItem.regression_risks} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm font-mono text-foreground"></textarea>
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
	{:else if viewMode === 'list'}
		<!-- ═══════════ LIST VIEW ═══════════ -->
		<div class="mt-6 space-y-3">
			{#each data.specs as spec}
				<div class="group rounded-xl border border-border bg-card">
					<div class="flex w-full items-center justify-between px-5 py-4 sm:px-6 sm:py-5">
						<button onclick={() => toggleSpec(spec.id)} class="flex flex-1 items-center gap-3 text-left min-w-0">
							<h3 class="truncate text-base font-semibold text-foreground sm:text-lg">{spec.title}</h3>
							<StatusBadge status={spec.status} size="sm" />
						</button>
						<div class="flex shrink-0 items-center gap-1">
							<div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
								<button onclick={() => openEdit(spec)} class="rounded p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Edit spec"><Pencil size={16} /></button>
								<button onclick={() => openDelete(spec)} class="rounded p-2 text-muted-foreground hover:bg-red-900/40 hover:text-red-300" aria-label="Delete spec"><Trash2 size={16} /></button>
							</div>
							<button onclick={() => toggleSpec(spec.id)} class="ml-1 rounded p-2 text-muted-foreground hover:bg-secondary" aria-label="Toggle">
								{#if expandedSpec === spec.id}<ChevronUp size={18} />{:else}<ChevronDown size={18} />{/if}
							</button>
						</div>
					</div>

					{#if expandedSpec === spec.id}
						<div class="border-t border-border px-5 py-5 sm:px-6">
							<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
								{#if spec.summary}
									<div>
										<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Summary</p>
										<Markdown content={spec.summary} />
									</div>
								{/if}
								{#if spec.goal}
									<div>
										<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Goal</p>
										<Markdown content={spec.goal} />
									</div>
								{/if}
								{#if spec.acceptance_criteria}
									<div>
										<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Acceptance Criteria</p>
										<Markdown content={spec.acceptance_criteria} />
									</div>
								{/if}
								{#if spec.edge_cases}
									<div>
										<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Edge Cases</p>
										<Markdown content={spec.edge_cases} />
									</div>
								{/if}
								{#if spec.regression_risks}
									<div class="lg:col-span-2">
										<p class="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Regression Risks</p>
										<Markdown content={spec.regression_risks} />
									</div>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{:else}
		<!-- ═══════════ BOARD VIEW ═══════════ -->
		<div class="mt-4">
			<!-- Zoom controls -->
			<div class="mb-3 flex items-center gap-2">
				<button onclick={zoomOut} class="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Zoom out"><ZoomOut size={16} /></button>
				<span class="min-w-[3rem] text-center text-xs font-medium text-muted-foreground">{Math.round(scale * 100)}%</span>
				<button onclick={zoomIn} class="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Zoom in"><ZoomIn size={16} /></button>
				<button onclick={resetView} class="rounded-lg border border-border bg-card p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Reset view"><Maximize2 size={16} /></button>
				<span class="ml-2 text-xs text-muted-foreground">Scroll to zoom · Drag to pan</span>
			</div>

			<!-- Board canvas -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				bind:this={boardEl}
				class="board-viewport relative overflow-hidden rounded-xl border-2 border-border bg-[#0c0c0e]"
				style="height: calc(100vh - 280px); min-height: 400px; cursor: {isPanning ? 'grabbing' : 'grab'};"
				onwheel={onWheel}
				onpointerdown={onPointerDown}
				onpointermove={onPointerMove}
				onpointerup={onPointerUp}
				onpointercancel={onPointerUp}
			>
				<!-- Grid dots background -->
				<div class="absolute inset-0 opacity-20" style="background-image: radial-gradient(circle, #3f3f46 1px, transparent 1px); background-size: {24 * scale}px {24 * scale}px; background-position: {panX % (24 * scale)}px {panY % (24 * scale)}px;"></div>

				<!-- Transformed content -->
				<div
					class="absolute left-0 top-0 origin-top-left"
					style="transform: translate({panX}px, {panY}px) scale({scale}); will-change: transform;"
				>
					<div class="flex gap-6 p-8">
						{#each specsByStatus as group}
							<div class="flex w-[340px] shrink-0 flex-col">
								<!-- Column header -->
								<div class="mb-4 flex items-center gap-3 rounded-lg border border-border bg-card/80 px-4 py-3 backdrop-blur">
									<StatusBadge status={group.status} />
									<span class="text-sm font-bold text-foreground">{group.label}</span>
									<span class="ml-auto rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">{group.specs.length}</span>
								</div>

								<!-- Cards -->
								<div class="flex flex-col gap-3">
									{#each group.specs as spec}
										<div class="rounded-xl border-2 bg-card/90 backdrop-blur transition-colors hover:border-primary/40 {statusColors[spec.status]}">
											<!-- Card header -->
											<div class="flex items-start justify-between gap-2 px-4 pt-4 pb-2">
												<button onclick={() => toggleBoardCard(spec.id)} class="flex-1 text-left">
													<h4 class="text-sm font-bold text-foreground leading-snug">{spec.title}</h4>
												</button>
												<div class="flex shrink-0 items-center gap-0.5">
													<button onclick={() => openEdit(spec)} class="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Edit"><Pencil size={12} /></button>
													<button onclick={() => openDelete(spec)} class="rounded p-1 text-muted-foreground hover:bg-red-900/40 hover:text-red-300" aria-label="Delete"><Trash2 size={12} /></button>
												</div>
											</div>

											<!-- Summary preview -->
											{#if spec.summary}
												<div class="px-4 pb-3">
													{#if boardExpanded === spec.id}
														<Markdown content={spec.summary} />
													{:else}
														<p class="line-clamp-2 text-xs text-muted-foreground">{spec.summary}</p>
													{/if}
												</div>
											{/if}

											<!-- Expanded detail -->
											{#if boardExpanded === spec.id}
												<div class="border-t border-border px-4 py-3 space-y-3">
													{#if spec.goal}
														<div>
															<p class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Goal</p>
															<Markdown content={spec.goal} />
														</div>
													{/if}
													{#if spec.acceptance_criteria}
														<div>
															<p class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Acceptance Criteria</p>
															<Markdown content={spec.acceptance_criteria} />
														</div>
													{/if}
													{#if spec.edge_cases}
														<div>
															<p class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Edge Cases</p>
															<Markdown content={spec.edge_cases} />
														</div>
													{/if}
													{#if spec.regression_risks}
														<div>
															<p class="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Regression Risks</p>
															<Markdown content={spec.regression_risks} />
														</div>
													{/if}
												</div>
											{/if}

											<!-- Footer toggle -->
											<button
												onclick={() => toggleBoardCard(spec.id)}
												class="flex w-full items-center justify-center rounded-b-xl border-t border-border py-1.5 text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
											>
												{#if boardExpanded === spec.id}<ChevronUp size={14} />{:else}<ChevronDown size={14} />{/if}
											</button>
										</div>
									{/each}

									{#if group.specs.length === 0}
										<div class="rounded-xl border border-dashed border-border/50 px-4 py-8 text-center">
											<p class="text-xs text-muted-foreground/50">No specs</p>
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
</div>

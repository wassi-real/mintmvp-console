<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { ListTodo, Plus, Loader, GripVertical, Pencil, Trash2 } from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	let tasks: any[] = $state([]);
	$effect(() => {
		tasks = data.tasks.map((t: any) => ({ ...t }));
	});

	const columns = [
		{ key: 'backlog', label: 'Backlog' },
		{ key: 'in_progress', label: 'In Progress' },
		{ key: 'review', label: 'Review' },
		{ key: 'testing', label: 'Testing' },
		{ key: 'deployed', label: 'Deployed' }
	] as const;

	type ColumnKey = (typeof columns)[number]['key'];

	const priorityColors: Record<string, string> = {
		low: 'text-zinc-400',
		medium: 'text-amber-400',
		high: 'text-red-400'
	};

	function tasksByStatus(status: string) {
		return tasks.filter((t) => t.status === status);
	}

	function shouldScrollColumn(status: string) {
		return tasksByStatus(status).length > 5;
	}

	// ── Drag & Drop ──
	let draggingId = $state<string | null>(null);
	let dragOverColumn = $state<string | null>(null);
	let savingIds = $state<Set<string>>(new Set());

	function onDragStart(e: DragEvent, taskId: string) {
		draggingId = taskId;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			e.dataTransfer.setData('text/plain', taskId);
		}
	}

	function onDragOver(e: DragEvent, columnKey: string) {
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		dragOverColumn = columnKey;
	}

	function onDragLeave(e: DragEvent, columnKey: string) {
		const related = e.relatedTarget as Node | null;
		const target = e.currentTarget as HTMLElement;
		if (!related || !target.contains(related)) {
			if (dragOverColumn === columnKey) dragOverColumn = null;
		}
	}

	function onDragEnd() {
		draggingId = null;
		dragOverColumn = null;
	}

	async function onDrop(e: DragEvent, newStatus: ColumnKey) {
		e.preventDefault();
		dragOverColumn = null;
		const taskId = e.dataTransfer?.getData('text/plain') ?? draggingId;
		if (!taskId) return;
		const task = tasks.find((t) => t.id === taskId);
		if (!task || task.status === newStatus) { draggingId = null; return; }
		tasks = tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t));
		draggingId = null;
		savingIds = new Set([...savingIds, taskId]);
		try {
			const body = new URLSearchParams({ taskId, status: newStatus });
			const res = await fetch('?/updateStatus', {
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded' },
				body: body.toString()
			});
			if (!res.ok) tasks = tasks.map((t) => (t.id === taskId ? { ...t, status: task.status } : t));
		} catch {
			tasks = tasks.map((t) => (t.id === taskId ? { ...t, status: task.status } : t));
		} finally {
			savingIds = new Set([...savingIds].filter((id) => id !== taskId));
		}
	}

	// ── Create Modal ──
	let createOpen = $state(false);
	let submitting = $state(false);
	let formError = $state('');

	// ── Edit Modal ──
	let editOpen = $state(false);
	let editTask = $state<any>(null);
	let editSubmitting = $state(false);
	let editError = $state('');

	function openEdit(task: any) {
		editTask = { ...task };
		editError = '';
		editOpen = true;
	}

	// ── Delete Confirm ──
	let deleteOpen = $state(false);
	let deleteTask = $state<any>(null);
	let deleteSubmitting = $state(false);

	function openDelete(task: any) {
		deleteTask = task;
		deleteOpen = true;
	}
</script>

<div>
	<PageHeader title="Tasks" description="Kanban board">
		{#snippet actions()}
			<button
				onclick={() => { formError = ''; createOpen = true; }}
				class="flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90"
			>
				<Plus size={20} />
				New Task
			</button>
		{/snippet}
	</PageHeader>

	<!-- ── Create Task Modal ── -->
	<Modal bind:open={createOpen} title="New Task">
		<form method="POST" action="?/create"
			use:enhance={() => { submitting = true; formError = '';
				return async ({ result }) => { submitting = false;
					if (result.type === 'failure') { formError = (result.data as any)?.error ?? 'Something went wrong.'; }
					else { createOpen = false; await invalidateAll(); }
				};
			}}
		>
			{#if formError}
				<div class="mb-4 rounded-lg bg-red-900/30 px-4 py-3 text-base text-red-300">{formError}</div>
			{/if}
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div class="sm:col-span-2">
					<label for="c-title" class="mb-1 block text-base font-medium text-foreground">Title <span class="text-destructive">*</span></label>
					<input id="c-title" name="title" required class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground" placeholder="Fix score calculation bug" />
				</div>
				<div>
					<label for="c-assignee" class="mb-1 block text-base font-medium text-foreground">Assignee</label>
					<input id="c-assignee" name="assignee" class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground" placeholder="Alex" />
				</div>
				<div>
					<label for="c-priority" class="mb-1 block text-base font-medium text-foreground">Priority</label>
					<select id="c-priority" name="priority" class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground">
						<option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option>
					</select>
				</div>
				<div>
					<label for="c-status" class="mb-1 block text-base font-medium text-foreground">Starting Column</label>
					<select id="c-status" name="status" class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground">
						{#each columns as col}<option value={col.key}>{col.label}</option>{/each}
					</select>
				</div>
				<div class="sm:col-span-2">
					<label for="c-desc" class="mb-1 block text-base font-medium text-foreground">Description</label>
					<textarea id="c-desc" name="description" rows="2" class="w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground" placeholder="Optional details..."></textarea>
				</div>
			</div>
			<div class="mt-6 flex gap-3">
				<button type="submit" disabled={submitting} class="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
					{#if submitting}<Loader size={18} class="animate-spin" />Creating...{:else}Create Task{/if}
				</button>
				<button type="button" onclick={() => (createOpen = false)} class="rounded-lg bg-secondary px-6 py-3 text-base font-medium text-foreground hover:bg-accent">Cancel</button>
			</div>
		</form>
	</Modal>

	<!-- ── Edit Task Modal ── -->
	<Modal bind:open={editOpen} title="Edit Task">
		{#if editTask}
			<form method="POST" action="?/update"
				use:enhance={() => { editSubmitting = true; editError = '';
					return async ({ result }) => { editSubmitting = false;
						if (result.type === 'failure') { editError = (result.data as any)?.error ?? 'Something went wrong.'; }
						else { editOpen = false; await invalidateAll(); }
					};
				}}
			>
				{#if editError}
					<div class="mb-4 rounded-lg bg-red-900/30 px-4 py-3 text-base text-red-300">{editError}</div>
				{/if}
				<input type="hidden" name="taskId" value={editTask.id} />
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div class="sm:col-span-2">
						<label for="e-title" class="mb-1 block text-base font-medium text-foreground">Title <span class="text-destructive">*</span></label>
						<input id="e-title" name="title" required bind:value={editTask.title} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground" />
					</div>
					<div>
						<label for="e-assignee" class="mb-1 block text-base font-medium text-foreground">Assignee</label>
						<input id="e-assignee" name="assignee" bind:value={editTask.assignee} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground" />
					</div>
					<div>
						<label for="e-priority" class="mb-1 block text-base font-medium text-foreground">Priority</label>
						<select id="e-priority" name="priority" bind:value={editTask.priority} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground">
							<option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
						</select>
					</div>
					<div>
						<label for="e-status" class="mb-1 block text-base font-medium text-foreground">Status</label>
						<select id="e-status" name="status" bind:value={editTask.status} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground">
							{#each columns as col}<option value={col.key}>{col.label}</option>{/each}
						</select>
					</div>
					<div class="sm:col-span-2">
						<label for="e-desc" class="mb-1 block text-base font-medium text-foreground">Description</label>
						<textarea id="e-desc" name="description" rows="2" bind:value={editTask.description} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground"></textarea>
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

	<!-- ── Delete Confirm Modal ── -->
	<Modal bind:open={deleteOpen} title="Delete Task">
		{#if deleteTask}
			<p class="text-lg text-foreground">Are you sure you want to delete <strong>{deleteTask.title}</strong>?</p>
			<p class="mt-2 text-base text-muted-foreground">This action cannot be undone.</p>
			<form method="POST" action="?/delete"
				use:enhance={() => { deleteSubmitting = true;
					return async ({ result }) => { deleteSubmitting = false;
						if (result.type !== 'failure') { deleteOpen = false; await invalidateAll(); }
					};
				}}
			>
				<input type="hidden" name="taskId" value={deleteTask.id} />
				<input type="hidden" name="taskTitle" value={deleteTask.title} />
				<div class="mt-6 flex gap-3">
					<button type="submit" disabled={deleteSubmitting} class="flex items-center gap-2 rounded-lg bg-destructive px-6 py-3 text-base font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-60">
						{#if deleteSubmitting}<Loader size={18} class="animate-spin" />Deleting...{:else}<Trash2 size={18} />Delete{/if}
					</button>
					<button type="button" onclick={() => (deleteOpen = false)} class="rounded-lg bg-secondary px-6 py-3 text-base font-medium text-foreground hover:bg-accent">Cancel</button>
				</div>
			</form>
		{/if}
	</Modal>

	{#if tasks.length === 0 && !createOpen}
		<EmptyState icon={ListTodo} title="No tasks yet" description="Create your first task." />
	{:else}
		<div class="mt-6 flex items-start gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
			{#each columns as col}
				<div
					role="region"
					aria-label="{col.label} column"
					class="flex w-[18rem] min-w-[18rem] snap-start self-start flex-col rounded-xl border-2 p-4 transition-colors xl:w-[19rem] xl:min-w-[19rem] {dragOverColumn === col.key ? 'border-primary/60 bg-primary/5' : 'border-border bg-card/50'}"
					ondragover={(e) => onDragOver(e, col.key)}
					ondragleave={(e) => onDragLeave(e, col.key)}
					ondrop={(e) => onDrop(e, col.key)}
				>
					<div class="mb-4 flex items-center justify-between">
						<h3 class="text-base font-semibold text-foreground">{col.label}</h3>
						<span class="rounded-full bg-secondary px-2.5 py-0.5 text-sm font-semibold text-muted-foreground">{tasksByStatus(col.key).length}</span>
					</div>
					<div class="flex flex-col gap-3 {shouldScrollColumn(col.key) ? 'max-h-[34rem] overflow-y-auto pr-1' : ''}">
						{#each tasksByStatus(col.key) as task (task.id)}
							<div
								role="listitem"
								draggable="true"
								ondragstart={(e) => onDragStart(e, task.id)}
								ondragend={onDragEnd}
								class="group cursor-grab rounded-lg border border-border bg-card p-4 transition-all active:cursor-grabbing active:opacity-50 {draggingId === task.id ? 'opacity-40 ring-2 ring-primary/50' : ''}"
							>
								<div class="mb-2 flex items-center justify-between">
									<GripVertical size={16} class="text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
									<div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
										{#if savingIds.has(task.id)}
											<Loader size={14} class="animate-spin text-muted-foreground" />
										{/if}
										<button onclick={() => openEdit(task)} class="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Edit task">
											<Pencil size={14} />
										</button>
										<button onclick={() => openDelete(task)} class="rounded p-1 text-muted-foreground hover:bg-red-900/40 hover:text-red-300" aria-label="Delete task">
											<Trash2 size={14} />
										</button>
									</div>
								</div>
								<p class="text-base font-semibold text-foreground">{task.title}</p>
								{#if task.description}
									<p class="mt-1 text-sm text-muted-foreground line-clamp-2">{task.description}</p>
								{/if}
								<div class="mt-3 flex items-center justify-between">
									<span class="text-sm font-medium {priorityColors[task.priority] ?? 'text-zinc-400'}">{task.priority}</span>
									{#if task.assignee}
										<span class="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">{task.assignee}</span>
									{/if}
								</div>
							</div>
						{/each}
						{#if tasksByStatus(col.key).length === 0}
							<div class="rounded-lg border-2 border-dashed border-border/50 py-8 text-center text-sm text-muted-foreground {dragOverColumn === col.key ? 'border-primary/40 text-primary/60' : ''}">Drop here</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

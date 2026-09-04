<script lang="ts">
	import { untrack } from 'svelte';
	import PageTitleBar from '$lib/components/PageTitleBar.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import { ListTodo, Plus, Loader, GripVertical, Pencil, Trash2, GitBranch } from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	// Local copy so drag-and-drop can move a card optimistically, then resync from the server.
	let tasks = $state<any[]>(untrack(() => data.tasks.map((t: any) => ({ ...t }))));
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
		low: 'text-muted-foreground',
		medium: 'text-warning',
		high: 'text-destructive'
	};

	const priorityDots: Record<string, string> = {
		low: 'bg-muted-foreground/50',
		medium: 'bg-warning',
		high: 'bg-destructive'
	};

	const grouped = $derived.by(() => {
		const groups: Record<string, any[]> = {};
		for (const col of columns) groups[col.key] = [];
		for (const task of tasks) (groups[task.status] ??= []).push(task);
		return groups;
	});

	function tasksByStatus(status: string) {
		return grouped[status] ?? [];
	}

	function shouldScrollColumn(status: string) {
		return tasksByStatus(status).length > 5;
	}

	const stats = $derived.by(() => {
		const inFlight = tasks.filter((t) =>
			['in_progress', 'review', 'testing'].includes(t.status)
		).length;
		const deployed = tasks.filter((t) => t.status === 'deployed').length;
		const highPriority = tasks.filter((t) => t.priority === 'high' && t.status !== 'deployed').length;
		return [
			{ label: 'Total', value: tasks.length, tone: 'text-foreground' },
			{ label: 'In flight', value: inFlight, tone: 'text-foreground' },
			{ label: 'Deployed', value: deployed, tone: deployed > 0 ? 'text-success' : 'text-foreground' },
			{
				label: 'High priority',
				value: highPriority,
				tone: highPriority > 0 ? 'text-destructive' : 'text-foreground'
			}
		];
	});

	function delay(i: number) {
		return `${Math.min(i, 8) * 40}ms`;
	}

	const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground';
	const fieldClass =
		'w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40';
	const btnPrimary =
		'press inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60';
	const btnQuiet =
		'press inline-flex items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent';
	const btnDanger =
		'press inline-flex items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-60';
	const errorClass =
		'mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive';

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

<PageTitleBar title="Tasks" description="Delivery board">
	{#snippet meta()}
		<span class="tabular-nums">{tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}</span>
		<span class="text-muted-foreground/40">·</span>
		<span class="tabular-nums">{stats[1].value} in flight</span>
		<span class="text-muted-foreground/40">·</span>
		<span class="tabular-nums">{stats[2].value} deployed</span>
	{/snippet}
	{#snippet actions()}
		<button
			onclick={() => { formError = ''; createOpen = true; }}
			class={btnPrimary}
		>
			<Plus size={17} />
			<span class="hidden sm:inline">New Task</span>
			<span class="sm:hidden">New</span>
		</button>
	{/snippet}
</PageTitleBar>

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
			<div class={errorClass}>{formError}</div>
		{/if}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<div class="sm:col-span-2">
				<label for="c-title" class={labelClass}>Title <span class="text-destructive">*</span></label>
				<input id="c-title" name="title" required class={fieldClass} placeholder="Fix score calculation bug" />
			</div>
			<div>
				<label for="c-assignee" class={labelClass}>Assignee</label>
				<input id="c-assignee" name="assignee" class={fieldClass} placeholder="Alex" />
			</div>
			<div>
				<label for="c-priority" class={labelClass}>Priority</label>
				<select id="c-priority" name="priority" class={fieldClass}>
					<option value="low">Low</option><option value="medium" selected>Medium</option><option value="high">High</option>
				</select>
			</div>
			<div>
				<label for="c-status" class={labelClass}>Starting Column</label>
				<select id="c-status" name="status" class={fieldClass}>
					{#each columns as col (col.key)}<option value={col.key}>{col.label}</option>{/each}
				</select>
			</div>
			<div class="sm:col-span-2">
				<label for="c-desc" class={labelClass}>Description</label>
				<textarea id="c-desc" name="description" rows="3" class={fieldClass} placeholder="Optional details..."></textarea>
			</div>
		</div>
		<div class="mt-6 flex flex-wrap gap-2">
			<button type="submit" disabled={submitting} class={btnPrimary}>
				{#if submitting}<Loader size={16} class="animate-spin" />Creating...{:else}Create Task{/if}
			</button>
			<button type="button" onclick={() => (createOpen = false)} class={btnQuiet}>Cancel</button>
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
				<div class={errorClass}>{editError}</div>
			{/if}
			<input type="hidden" name="taskId" value={editTask.id} />
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div class="sm:col-span-2">
					<label for="e-title" class={labelClass}>Title <span class="text-destructive">*</span></label>
					<input id="e-title" name="title" required bind:value={editTask.title} class={fieldClass} />
				</div>
				<div>
					<label for="e-assignee" class={labelClass}>Assignee</label>
					<input id="e-assignee" name="assignee" bind:value={editTask.assignee} class={fieldClass} />
				</div>
				<div>
					<label for="e-priority" class={labelClass}>Priority</label>
					<select id="e-priority" name="priority" bind:value={editTask.priority} class={fieldClass}>
						<option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option>
					</select>
				</div>
				<div>
					<label for="e-status" class={labelClass}>Status</label>
					<select id="e-status" name="status" bind:value={editTask.status} class={fieldClass}>
						{#each columns as col (col.key)}<option value={col.key}>{col.label}</option>{/each}
					</select>
				</div>
				<div class="sm:col-span-2">
					<label for="e-desc" class={labelClass}>Description</label>
					<textarea id="e-desc" name="description" rows="3" bind:value={editTask.description} class={fieldClass}></textarea>
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

<!-- ── Delete Confirm Modal ── -->
<Modal bind:open={deleteOpen} title="Delete Task">
	{#if deleteTask}
		<p class="text-base text-foreground">
			Delete <strong class="font-semibold">{deleteTask.title}</strong>?
		</p>
		<p class="mt-1 text-sm text-muted-foreground">This action cannot be undone.</p>
		<form method="POST" action="?/delete"
			use:enhance={() => { deleteSubmitting = true;
				return async ({ result }) => { deleteSubmitting = false;
					if (result.type !== 'failure') { deleteOpen = false; await invalidateAll(); }
				};
			}}
		>
			<input type="hidden" name="taskId" value={deleteTask.id} />
			<input type="hidden" name="taskTitle" value={deleteTask.title} />
			<div class="mt-6 flex flex-wrap gap-2">
				<button type="submit" disabled={deleteSubmitting} class={btnDanger}>
					{#if deleteSubmitting}<Loader size={16} class="animate-spin" />Deleting...{:else}<Trash2 size={16} />Delete{/if}
				</button>
				<button type="button" onclick={() => (deleteOpen = false)} class={btnQuiet}>Cancel</button>
			</div>
		</form>
	{/if}
</Modal>

{#if tasks.length === 0 && !createOpen}
	<EmptyState icon={ListTodo} title="No tasks yet" description="Create your first task." />
{:else}
	<!-- Board totals, grouped into a single quiet card -->
	<div
		class="rise grid grid-cols-2 gap-y-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-4 sm:gap-y-0 sm:divide-x sm:divide-border/60 sm:p-5"
	>
		{#each stats as stat (stat.label)}
			<div class="sm:px-5 sm:first:pl-0 sm:last:pr-0">
				<p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
					{stat.label}
				</p>
				<p class="mt-1 text-2xl font-bold tabular-nums leading-none {stat.tone}">{stat.value}</p>
			</div>
		{/each}
	</div>

	<div class="mt-4 flex items-start gap-3 overflow-x-auto pb-3 snap-x snap-mandatory">
		{#each columns as col, ci (col.key)}
			<div
				role="region"
				aria-label="{col.label} column"
				class="rise flex w-[16.5rem] min-w-[16.5rem] snap-start self-start flex-col rounded-xl border p-3 transition-colors xl:w-[18rem] xl:min-w-[18rem] {dragOverColumn ===
				col.key
					? 'border-primary/60 bg-primary/5'
					: 'border-border bg-card/40'}"
				style:--delay={delay(ci)}
				ondragover={(e) => onDragOver(e, col.key)}
				ondragleave={(e) => onDragLeave(e, col.key)}
				ondrop={(e) => onDrop(e, col.key)}
			>
				<div class="mb-3 flex items-center justify-between gap-2 px-1">
					<h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						{col.label}
					</h3>
					<span
						class="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground"
					>
						{tasksByStatus(col.key).length}
					</span>
				</div>

				<div
					class="flex flex-col gap-2 {shouldScrollColumn(col.key)
						? 'scroll-area max-h-[32rem] overflow-y-auto pr-1'
						: ''}"
				>
					{#each tasksByStatus(col.key) as task (task.id)}
						<div
							role="listitem"
							draggable="true"
							ondragstart={(e) => onDragStart(e, task.id)}
							ondragend={onDragEnd}
							class="card-hover group cursor-grab rounded-lg border border-border bg-card p-3 active:cursor-grabbing {draggingId ===
							task.id
								? 'opacity-40 ring-2 ring-ring/50'
								: ''}"
						>
							<div class="flex items-start gap-1.5">
								<GripVertical
									size={14}
									class="mt-0.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground"
								/>
								<p class="min-w-0 flex-1 text-sm font-semibold leading-snug text-foreground">
									{task.title}
								</p>
								<div
									class="flex shrink-0 items-center gap-0.5 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
								>
									{#if savingIds.has(task.id)}
										<Loader size={13} class="animate-spin text-muted-foreground" />
									{/if}
									<button
										onclick={() => openEdit(task)}
										class="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
										aria-label="Edit task"
									>
										<Pencil size={13} />
									</button>
									<button
										onclick={() => openDelete(task)}
										class="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
										aria-label="Delete task"
									>
										<Trash2 size={13} />
									</button>
								</div>
							</div>

							{#if task.description}
								<p class="mt-1.5 pl-5 text-xs leading-relaxed text-muted-foreground line-clamp-2">
									{task.description}
								</p>
							{/if}

							{#if task.branch_name}
								<p
									class="mt-2 flex items-center gap-1 pl-5 font-mono text-xs text-muted-foreground"
								>
									<GitBranch size={12} class="shrink-0" />
									<span class="truncate">{task.branch_name}</span>
								</p>
							{/if}

							<div class="mt-2.5 flex items-center justify-between gap-2 pl-5">
								<span
									class="inline-flex items-center gap-1.5 text-xs font-medium capitalize {priorityColors[
										task.priority
									] ?? 'text-muted-foreground'}"
								>
									<span
										class="h-1.5 w-1.5 rounded-full {priorityDots[task.priority] ??
											'bg-muted-foreground/50'}"
									></span>
									{task.priority}
								</span>
								{#if task.assignee}
									<span
										class="max-w-[8rem] truncate rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground"
									>
										{task.assignee}
									</span>
								{/if}
							</div>
						</div>
					{/each}

					{#if tasksByStatus(col.key).length === 0}
						<div
							class="rounded-lg border border-dashed py-7 text-center text-xs transition-colors {dragOverColumn ===
							col.key
								? 'border-primary/40 text-primary'
								: 'border-border/60 text-muted-foreground'}"
						>
							Drop here
						</div>
					{/if}
				</div>
			</div>
		{/each}
	</div>
{/if}

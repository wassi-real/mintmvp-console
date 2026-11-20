<script lang="ts">
	import CornerDownRight from '@lucide/svelte/icons/corner-down-right';
	import List from '@lucide/svelte/icons/list';
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';
	import SquareKanban from '@lucide/svelte/icons/square-kanban';
	import { tick } from 'svelte';
	import { flip } from 'svelte/animate';
	import { enhance } from '$app/forms';
	import Avatar from '#lib/components/Avatar.svelte';
	import Badge from '#lib/components/Badge.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import RecordDialog from '#lib/components/RecordDialog.svelte';
	import { TASK_STATUSES, priority, taskStatus } from '#lib/constants.ts';
	import { formatDate, isOverdue } from '#lib/format.ts';
	import { taskFields } from '#lib/sections.ts';
	import { toasts } from '#lib/toast.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const base = $derived(`/dashboard/projects/${data.project.id}/tasks`);

	let creating = $state(false);
	let createStatus = $state('backlog');
	let query = $state('');
	let who = $state('all');
	let showDone = $state(false);

	$effect(() => {
		if (data.openNew && data.canEdit) creating = true;
	});

	// A moved card shows in its new column straight away, before the server answers.
	let overrides = $state<Record<string, string>>({});
	const tasks = $derived(
		data.tasks.map((task) => ({ ...task, status: overrides[task.id] ?? task.status }))
	);

	const filtered = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		return tasks.filter((task) => {
			if (who === 'me' && task.assignee_user_id !== data.me.id) return false;
			if (who === 'none' && task.assignee_user_id) return false;
			if (who !== 'all' && who !== 'me' && who !== 'none' && task.assignee_user_id !== who) return false;
			if (!needle) return true;
			return (
				task.title.toLowerCase().includes(needle) ||
				task.labels.some((label) => label.toLowerCase().includes(needle))
			);
		});
	});
	const listed = $derived(filtered.filter((task) => showDone || task.status !== 'deployed'));
	const doneCount = $derived(filtered.filter((task) => task.status === 'deployed').length);

	const fields = $derived(
		taskFields({
			members: data.members,
			specs: data.specs,
			tasks: data.tasks
				.filter((task) => !task.parent_task_id)
				.map((task) => ({ value: task.id, label: task.title }))
		}).map((field) => (field.name === 'status' ? { ...field, initial: createStatus } : field))
	);

	// ── Moving tasks between stages ──
	let moveForm = $state<HTMLFormElement>();
	let moveId = $state('');
	let moveStatus = $state('');
	let dragging = $state<string | null>(null);
	let over = $state<string | null>(null);

	async function move(id: string, status: string) {
		const task = tasks.find((item) => item.id === id);
		if (!task || task.status === status) return;
		overrides[id] = status;
		moveId = id;
		moveStatus = status;
		await tick();
		moveForm?.requestSubmit();
	}

	function newTask(status = 'backlog') {
		createStatus = status;
		creating = true;
	}
</script>

<svelte:head>
	<title>{data.view === 'board' ? 'Board' : 'Tasks'} · {data.project.name}</title>
</svelte:head>

<PageHeader
	title={data.view === 'board' ? 'Board' : 'Tasks'}
	description={data.view === 'board'
		? 'Drag a card to another column to change its stage.'
		: 'Everything that needs doing in this project.'}
>
	<nav class="seg" aria-label="View">
		<a href={base} class="seg-item" aria-current={data.view === 'list' ? 'page' : undefined}>
			<List size={18} /> List
		</a>
		<a href="{base}?view=board" class="seg-item" aria-current={data.view === 'board' ? 'page' : undefined}>
			<SquareKanban size={18} /> Board
		</a>
	</nav>
	{#if data.canEdit}
		<button type="button" class="btn btn-primary" onclick={() => newTask()}>
			<Plus size={20} /> New task
		</button>
	{/if}
</PageHeader>

{#if data.tasks.length === 0}
	<EmptyState title="No tasks yet" message="Break the work into tasks so everyone knows what to do next.">
		{#if data.canEdit}
			<button type="button" class="btn btn-primary btn-lg" onclick={() => newTask()}>
				<Plus size={20} /> Add the first task
			</button>
		{/if}
	</EmptyState>
{:else}
	<!-- Filters -->
	<div class="mb-6 flex flex-wrap items-center gap-3">
		<label class="relative block min-w-56 flex-1 sm:max-w-sm">
			<span class="sr-only">Search tasks</span>
			<Search size={19} class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-faint" />
			<input type="search" class="input pl-11!" placeholder="Search tasks or labels" bind:value={query} />
		</label>
		<label class="flex items-center gap-2.5">
			<span class="text-[0.95rem] font-semibold text-muted">Assigned to</span>
			<select class="select w-auto" bind:value={who}>
				<option value="all">Anyone</option>
				<option value="me">Me</option>
				<option value="none">Nobody</option>
				{#each data.members.filter((member) => member.value !== data.me.id) as member (member.value)}
					<option value={member.value}>{member.label}</option>
				{/each}
			</select>
		</label>
		{#if data.view === 'list' && doneCount > 0}
			<label class="choice min-h-12! py-0!">
				<input type="checkbox" class="checkbox" bind:checked={showDone} />
				<span class="font-semibold">Show done ({doneCount})</span>
			</label>
		{/if}
	</div>

	{#if data.view === 'board'}
		<!-- Board -->
		<div class="-mx-2 overflow-x-auto px-2 pb-4">
			<div class="grid min-w-max grid-flow-col auto-cols-[19rem] gap-4 xl:min-w-0 xl:auto-cols-fr">
				{#each TASK_STATUSES as column (column.value)}
					{@const cards = filtered.filter((task) => task.status === column.value)}
					<section
						class="flex min-h-64 flex-col rounded-block-lg border bg-surface transition-colors duration-150 {over ===
						column.value
							? 'border-fg bg-surface-2'
							: 'border-line'}"
						aria-label="{column.label}: {cards.length} tasks"
						ondragover={(event) => {
							if (!dragging) return;
							event.preventDefault();
							over = column.value;
						}}
						ondragleave={(event) => {
							if (!event.currentTarget.contains(event.relatedTarget as Node | null)) over = null;
						}}
						ondrop={(event) => {
							event.preventDefault();
							if (dragging) move(dragging, column.value);
							dragging = null;
							over = null;
						}}
					>
						<header class="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
							<h2 class="flex items-center gap-2.5 text-[1.05rem]">
								{column.label}
								<span class="chip text-muted tabular-nums">{cards.length}</span>
							</h2>
							{#if data.canEdit}
								<button
									type="button"
									class="btn btn-ghost btn-sm btn-icon"
									aria-label="New task in {column.label}"
									title="New task here"
									onclick={() => newTask(column.value)}
								>
									<Plus size={18} />
								</button>
							{/if}
						</header>

						<ul class="flex flex-1 flex-col gap-3 px-3 pb-3">
							{#each cards as task (task.id)}
								<li
									class="rounded-block border border-line bg-surface-2 p-4 transition-[opacity,transform,border-color] duration-150 hover:border-line-strong {data.canEdit
										? 'cursor-grab active:cursor-grabbing'
										: ''} {dragging === task.id ? 'scale-[0.97] opacity-40' : ''}"
									draggable={data.canEdit}
									ondragstart={(event) => {
										dragging = task.id;
										event.dataTransfer?.setData('text/plain', task.id);
										if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
									}}
									ondragend={() => {
										dragging = null;
										over = null;
									}}
									animate:flip={{ duration: 220 }}
								>
									<a href="{base}/{task.id}" class="block leading-snug font-semibold hover:underline" draggable="false">
										{task.title}
									</a>
									{#if task.parentTitle}
										<p class="mt-1.5 flex items-center gap-1.5 text-[0.82rem] text-muted">
											<CornerDownRight size={14} class="shrink-0" />
											<span class="truncate">{task.parentTitle}</span>
										</p>
									{/if}
									{#if task.labels.length || task.blocked || task.subtasks}
										<div class="mt-2.5 flex flex-wrap gap-1.5">
											{#if task.blocked}<span class="chip bg-surface-3 text-bad">Blocked</span>{/if}
											{#if task.subtasks}
												<span class="chip bg-surface-3 text-muted">
													{task.subtasks.done}/{task.subtasks.total} subtasks
												</span>
											{/if}
											{#each task.labels as label (label)}
												<span class="chip bg-surface-3 text-muted">{label}</span>
											{/each}
										</div>
									{/if}
									<div class="mt-3.5 flex items-center justify-between gap-2">
										<div class="flex min-w-0 flex-wrap items-center gap-2 text-[0.82rem]">
											{#if task.priority !== 'medium'}
												<span class="font-semibold {task.priority === 'high' ? 'text-bad' : 'text-muted'}">
													{priority(task.priority).label}
												</span>
											{/if}
											{#if task.due_date}
												<span class={isOverdue(task.due_date) && task.status !== 'deployed' ? 'font-semibold text-bad' : 'text-muted'}>
													{formatDate(task.due_date)}
												</span>
											{/if}
										</div>
										{#if task.assigneeName}
											<span title="Assigned to {task.assigneeName}">
												<Avatar name={task.assigneeName} src={task.assigneeAvatar} size={28} />
												<span class="sr-only">Assigned to {task.assigneeName}</span>
											</span>
										{/if}
									</div>
									{#if data.canEdit}
										<label class="mt-3 block">
											<span class="sr-only">Stage for {task.title}</span>
											<select
												class="select min-h-9! w-full py-1! text-[0.85rem]!"
												value={task.status}
												onchange={(event) => move(task.id, event.currentTarget.value)}
											>
												{#each TASK_STATUSES as option (option.value)}
													<option value={option.value}>{option.label}</option>
												{/each}
											</select>
										</label>
									{/if}
								</li>
							{:else}
								<li class="flex flex-1 items-center justify-center rounded-block border-2 border-dashed border-line px-3 py-8 text-center text-[0.9rem] text-faint">
									{data.canEdit ? 'Drop a task here' : 'Nothing here'}
								</li>
							{/each}
						</ul>
					</section>
				{/each}
			</div>
		</div>
	{:else if listed.length === 0}
		<EmptyState
			title="No tasks match"
			message={doneCount > 0 && !showDone ? 'Everything here is done. Turn on “Show done” to see it.' : 'Try a different search or filter.'}
		/>
	{:else}
		<!-- List -->
		<ul class="list">
			{#each listed as task (task.id)}
				<li class="list-row flex-wrap" animate:flip={{ duration: 220 }}>
					<div class="min-w-64 flex-1">
						<a href="{base}/{task.id}" class="text-[1.05rem] font-semibold hover:underline {task.status === 'deployed' ? 'text-muted line-through' : ''}">
							{task.title}
						</a>
						<div class="mt-1.5 flex flex-wrap items-center gap-1.5 text-[0.85rem] text-muted">
							{#if task.parentTitle}
								<span class="flex items-center gap-1"><CornerDownRight size={14} /> {task.parentTitle}</span>
							{/if}
							{#if task.blocked}<span class="chip text-bad">Blocked</span>{/if}
							{#if task.subtasks}
								<span class="chip">{task.subtasks.done}/{task.subtasks.total} subtasks</span>
							{/if}
							{#each task.labels as label (label)}
								<span class="chip">{label}</span>
							{/each}
						</div>
					</div>

					<div class="flex flex-wrap items-center gap-3">
						{#if task.due_date}
							<span class="text-[0.9rem] whitespace-nowrap {isOverdue(task.due_date) && task.status !== 'deployed' ? 'font-semibold text-bad' : 'text-muted'}">
								Due {formatDate(task.due_date)}
							</span>
						{/if}
						{#if task.priority !== 'medium'}
							<Badge option={{ ...priority(task.priority), label: `${priority(task.priority).label} priority` }} />
						{/if}
						{#if task.assigneeName}
							<span class="flex items-center gap-2 text-[0.9rem]">
								<Avatar name={task.assigneeName} src={task.assigneeAvatar} size={30} />
								<span class="hidden max-w-32 truncate sm:inline">{task.assigneeName}</span>
							</span>
						{/if}
						{#if data.canEdit}
							<label>
								<span class="sr-only">Stage for {task.title}</span>
								<select
									class="select min-h-10! w-36 py-1.5! text-[0.92rem]!"
									value={task.status}
									onchange={(event) => move(task.id, event.currentTarget.value)}
								>
									{#each TASK_STATUSES as option (option.value)}
										<option value={option.value}>{option.label}</option>
									{/each}
								</select>
							</label>
						{:else}
							<Badge option={taskStatus(task.status)} />
						{/if}
					</div>
				</li>
			{/each}
		</ul>
	{/if}
{/if}

{#if data.canEdit}
	{#key createStatus}
		<RecordDialog bind:open={creating} noun="task" {fields} size="lg" />
	{/key}

	<form
		bind:this={moveForm}
		method="POST"
		action="?/move"
		hidden
		use:enhance={({ formData }) => {
			const id = String(formData.get('id'));
			return async ({ result, update }) => {
				await update({ reset: false });
				delete overrides[id];
				if (result.type === 'failure') {
					toasts.show(String(result.data?.message ?? 'That task could not be moved.'), 'bad');
				}
			};
		}}
	>
		<input type="hidden" name="id" value={moveId} />
		<input type="hidden" name="status" value={moveStatus} />
	</form>
{/if}

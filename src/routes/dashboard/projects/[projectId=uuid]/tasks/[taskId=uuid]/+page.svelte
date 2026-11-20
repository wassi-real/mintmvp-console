<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Send from '@lucide/svelte/icons/send';
	import Trash from '@lucide/svelte/icons/trash';
	import X from '@lucide/svelte/icons/x';
	import Avatar from '#lib/components/Avatar.svelte';
	import Badge from '#lib/components/Badge.svelte';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import Form from '#lib/components/Form.svelte';
	import RecordDialog from '#lib/components/RecordDialog.svelte';
	import Time from '#lib/components/Time.svelte';
	import { TASK_STATUSES, priority, taskStatus } from '#lib/constants.ts';
	import { formatDate, isOverdue, percent } from '#lib/format.ts';
	import { taskFields } from '#lib/sections.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const base = $derived(`/dashboard/projects/${data.project.id}/tasks`);
	const task = $derived(data.task);
	const fields = $derived(taskFields({ members: data.members, specs: data.specs, tasks: data.parents }));
	const subtasksDone = $derived(data.subtasks.filter((item) => item.status === 'deployed').length);
	const waiting = $derived(data.blockedBy.filter((item) => item.status !== 'deployed'));

	let editing = $state(false);
	let deleting = $state(false);
	let deletingComment = $state<string | null>(null);
	let deleteCommentOpen = $state(false);
</script>

<svelte:head>
	<title>{task.title} · {data.project.name}</title>
</svelte:head>

<a href={base} class="btn btn-ghost btn-sm mb-5 -ml-2 text-muted"><ArrowLeft size={17} /> All tasks</a>

<header class="mb-8 flex flex-wrap items-start justify-between gap-5">
	<div class="min-w-0 flex-1">
		{#if data.parent}
			<p class="mb-2 text-muted">
				Part of <a href="{base}/{data.parent.id}" class="link text-fg">{data.parent.title}</a>
			</p>
		{/if}
		<h1 class="text-3xl wrap-break-word sm:text-4xl">{task.title}</h1>
		<div class="mt-4 flex flex-wrap items-center gap-2.5">
			<Badge option={taskStatus(task.status)} />
			<Badge option={{ ...priority(task.priority), label: `${priority(task.priority).label} priority` }} />
			{#if waiting.length}<Badge label="Blocked" tone="bad" />{/if}
			{#each task.labels as label (label)}<span class="chip text-muted">{label}</span>{/each}
		</div>
	</div>
	{#if data.canEdit}
		<div class="flex gap-3">
			<button type="button" class="btn" onclick={() => (editing = true)}><Pencil size={18} /> Edit</button>
			<button type="button" class="btn btn-danger btn-icon" aria-label="Delete task" title="Delete" onclick={() => (deleting = true)}>
				<Trash size={18} />
			</button>
		</div>
	{/if}
</header>

<div class="grid gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
	<div class="grid content-start gap-8">
		<section class="panel">
			<header class="panel-header"><h2 class="panel-title">Details</h2></header>
			<div class="panel-body">
				{#if task.description}
					<p class="whitespace-pre-wrap">{task.description}</p>
				{:else}
					<p class="text-muted">No details were added.</p>
				{/if}
			</div>
		</section>

		{#if !task.parent_task_id}
			<section class="panel">
				<header class="panel-header">
					<h2 class="panel-title flex items-center gap-3">
						Subtasks
						{#if data.subtasks.length}
							<span class="chip text-muted tabular-nums">{subtasksDone}/{data.subtasks.length}</span>
						{/if}
					</h2>
				</header>
				{#if data.subtasks.length}
					<div class="px-6 pt-5">
						<div class="progress" aria-hidden="true">
							<span style="width: {percent(subtasksDone, data.subtasks.length)}%"></span>
						</div>
					</div>
					<ul class="mt-3">
						{#each data.subtasks as subtask (subtask.id)}
							<li class="list-row">
								<a href="{base}/{subtask.id}" class="min-w-0 flex-1 truncate font-semibold hover:underline {subtask.status === 'deployed' ? 'text-muted line-through' : ''}">
									{subtask.title}
								</a>
								{#if subtask.assigneeName}<span class="hidden text-[0.9rem] text-muted sm:inline">{subtask.assigneeName}</span>{/if}
								{#if data.canEdit}
									<Form action="?/move" toast={false}>
										{#snippet children({ pending })}
											<input type="hidden" name="id" value={subtask.id} />
											<label>
												<span class="sr-only">Stage for {subtask.title}</span>
												<select
													name="status"
													class="select min-h-10! w-36 py-1.5! text-[0.92rem]!"
													disabled={pending}
													onchange={(event) => event.currentTarget.form?.requestSubmit()}
												>
													{#each TASK_STATUSES as option (option.value)}
														<option value={option.value} selected={option.value === subtask.status}>{option.label}</option>
													{/each}
												</select>
											</label>
										{/snippet}
									</Form>
								{:else}
									<Badge option={taskStatus(subtask.status)} />
								{/if}
							</li>
						{/each}
					</ul>
				{:else if !data.canEdit}
					<div class="panel-body text-muted">No subtasks.</div>
				{/if}
				{#if data.canEdit}
					<div class="border-t border-line p-5">
						<Form action="?/subtask">
							{#snippet children({ pending })}
								<div class="flex gap-3">
									<label class="min-w-0 flex-1">
										<span class="sr-only">New subtask</span>
										<input name="title" class="input" maxlength="200" placeholder="Add a smaller step…" required />
									</label>
									<button type="submit" class="btn shrink-0" disabled={pending}><Plus size={18} /> Add</button>
								</div>
							{/snippet}
						</Form>
					</div>
				{/if}
			</section>
		{/if}

		<section class="panel">
			<header class="panel-header">
				<h2 class="panel-title flex items-center gap-3">
					Comments <span class="chip text-muted tabular-nums">{data.comments.length}</span>
				</h2>
			</header>
			<div class="panel-body grid gap-5">
				{#each data.comments as comment (comment.id)}
					<article class="flex gap-4">
						<Avatar name={comment.author_name || 'Someone'} src={comment.avatarUrl} size={40} />
						<div class="min-w-0 flex-1 rounded-block bg-surface-2 px-4 py-3">
							<div class="flex items-center justify-between gap-3">
								<p class="text-[0.92rem]">
									<strong>{comment.author_name || 'Someone'}</strong>
									<span class="text-muted"> · <Time value={comment.created_at} relative /></span>
								</p>
								{#if comment.author_user_id === data.me.id || data.isOwner}
									<button
										type="button"
										class="btn btn-ghost btn-sm btn-icon -my-1 -mr-2"
										aria-label="Delete comment"
										title="Delete"
										onclick={() => {
											deletingComment = comment.id;
											deleteCommentOpen = true;
										}}
									>
										<X size={16} />
									</button>
								{/if}
							</div>
							<p class="mt-1 wrap-break-word whitespace-pre-wrap">{comment.body}</p>
						</div>
					</article>
				{:else}
					<p class="text-muted">No comments yet. Start the conversation.</p>
				{/each}

				<Form action="?/comment" toast={false}>
					{#snippet children({ pending })}
						<div class="flex gap-4">
							<Avatar name={data.me.name} src={data.me.avatarUrl} size={40} />
							<div class="min-w-0 flex-1">
								<label class="sr-only" for="comment-body">Write a comment</label>
								<textarea id="comment-body" name="body" class="textarea" rows="3" maxlength="5000" placeholder="Write a comment…" required></textarea>
								<div class="mt-3 flex justify-end">
									<button type="submit" class="btn btn-primary" disabled={pending}>
										<Send size={17} /> {pending ? 'Posting…' : 'Post comment'}
									</button>
								</div>
							</div>
						</div>
					{/snippet}
				</Form>
			</div>
		</section>
	</div>

	<aside class="grid content-start gap-8">
		<section class="panel">
			<dl class="grid gap-5 p-6">
				<div>
					<dt class="eyebrow">Stage</dt>
					<dd class="mt-2">
						{#if data.canEdit}
							<Form action="?/move">
								{#snippet children({ pending })}
									<input type="hidden" name="id" value={task.id} />
									<label>
										<span class="sr-only">Stage</span>
										<select name="status" class="select" disabled={pending} onchange={(event) => event.currentTarget.form?.requestSubmit()}>
											{#each TASK_STATUSES as option (option.value)}
												<option value={option.value} selected={option.value === task.status}>{option.label}</option>
											{/each}
										</select>
									</label>
								{/snippet}
							</Form>
						{:else}
							<Badge option={taskStatus(task.status)} />
						{/if}
					</dd>
				</div>
				<div>
					<dt class="eyebrow">Assigned to</dt>
					<dd class="mt-2 flex items-center gap-2.5">
						{#if data.assignee}
							<Avatar name={data.assignee.name} src={data.assignee.avatarUrl} size={32} />
							<span class="font-semibold">{data.assignee.name}</span>
						{:else}
							<span class="text-muted">Nobody yet</span>
						{/if}
					</dd>
				</div>
				<div>
					<dt class="eyebrow">Due date</dt>
					<dd class="mt-2 font-semibold {isOverdue(task.due_date) && task.status !== 'deployed' ? 'text-bad' : ''}">
						{task.due_date ? formatDate(task.due_date) : '—'}
						{#if isOverdue(task.due_date) && task.status !== 'deployed'}(late){/if}
					</dd>
				</div>
				{#if data.specTitle}
					<div>
						<dt class="eyebrow">Related spec</dt>
						<dd class="mt-2"><a class="link" href="/dashboard/projects/{data.project.id}/specs">{data.specTitle}</a></dd>
					</div>
				{/if}
				{#if task.branch_name}
					<div>
						<dt class="eyebrow">Code branch</dt>
						<dd class="mono mt-2 break-all">{task.branch_name}</dd>
					</div>
				{/if}
				<div>
					<dt class="eyebrow">Created</dt>
					<dd class="mt-2 text-muted"><Time value={task.created_at} /></dd>
				</div>
			</dl>
		</section>

		<section class="panel">
			<header class="panel-header"><h2 class="panel-title">Must be finished first</h2></header>
			<div class="p-5">
				{#if data.blockedBy.length === 0}
					<p class="text-muted">This task is not waiting for anything.</p>
				{:else}
					<ul class="grid gap-2">
						{#each data.blockedBy as other (other.id)}
							<li class="flex items-center gap-2 rounded-block bg-surface-2 py-2 pr-2 pl-4">
								<a href="{base}/{other.id}" class="min-w-0 flex-1 truncate font-medium hover:underline {other.status === 'deployed' ? 'text-muted line-through' : ''}">
									{other.title}
								</a>
								{#if data.canEdit}
									<Form action="?/removeDependency" toast={false}>
										{#snippet children({ pending })}
											<input type="hidden" name="id" value={other.id} />
											<button type="submit" class="btn btn-ghost btn-sm btn-icon" aria-label="Stop waiting for {other.title}" title="Remove" disabled={pending}>
												<X size={16} />
											</button>
										{/snippet}
									</Form>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}

				{#if data.canEdit && data.candidates.length}
					<Form action="?/addDependency" toast={false} class="mt-4">
						{#snippet children({ pending })}
							<label class="sr-only" for="depends-on">Task that must be finished first</label>
							<div class="flex gap-2">
								<select id="depends-on" name="depends_on_task_id" class="select min-w-0 flex-1" required>
									<option value="" selected disabled>Choose a task…</option>
									{#each data.candidates as option (option.value)}
										<option value={option.value}>{option.label}</option>
									{/each}
								</select>
								<button type="submit" class="btn shrink-0" disabled={pending}>Add</button>
							</div>
						{/snippet}
					</Form>
				{/if}

				{#if data.blocking.length}
					<p class="eyebrow mt-6 mb-2">Waiting for this task</p>
					<ul class="grid gap-2">
						{#each data.blocking as other (other.id)}
							<li class="rounded-block bg-surface-2 px-4 py-2.5">
								<a href="{base}/{other.id}" class="block truncate font-medium hover:underline">{other.title}</a>
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</section>
	</aside>
</div>

{#if data.canEdit}
	<RecordDialog bind:open={editing} noun="task" {fields} record={task} size="lg" />
	<ConfirmDialog
		bind:open={deleting}
		title="Delete this task?"
		message={`“${task.title}” will be permanently deleted, together with its subtasks and comments.`}
		values={{ id: task.id }}
	/>
{/if}
<ConfirmDialog
	bind:open={deleteCommentOpen}
	title="Delete this comment?"
	message="The comment will be permanently deleted."
	action="?/deleteComment"
	values={{ id: deletingComment ?? '' }}
/>

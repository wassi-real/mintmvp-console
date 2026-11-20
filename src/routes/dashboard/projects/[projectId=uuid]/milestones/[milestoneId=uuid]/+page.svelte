<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash from '@lucide/svelte/icons/trash';
	import X from '@lucide/svelte/icons/x';
	import Badge from '#lib/components/Badge.svelte';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import DataSection from '#lib/components/DataSection.svelte';
	import Form from '#lib/components/Form.svelte';
	import RecordDialog from '#lib/components/RecordDialog.svelte';
	import {
		SLICE_STATUSES,
		milestonePaymentStatus,
		milestonePhase,
		milestonePriority,
		sliceStatus,
		taskStatus
	} from '#lib/constants.ts';
	import { formatDate, formatMoney, isOverdue, percent } from '#lib/format.ts';
	import { milestoneFields, sliceFields } from '#lib/sections.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const base = $derived(`/dashboard/projects/${data.project.id}`);
	const milestone = $derived(data.milestone);
	const fields = $derived(milestoneFields({ members: data.members, specs: data.specs }));
	const stepFields = $derived(sliceFields({ members: data.members }));
	const done = $derived(data.slices.filter((slice) => slice.status === 'done').length);

	const notes = $derived(
		[
			{ label: 'What will be delivered', text: milestone.deliverables },
			{ label: 'Risks and blockers', text: milestone.risks_blockers },
			{ label: 'Needed before starting', text: milestone.entry_gate },
			{ label: 'Needed before finishing', text: milestone.exit_gate },
			{ label: 'Depends on', text: milestone.dependencies },
			{ label: 'Notes', text: milestone.notes }
		].filter((note) => note.text?.trim())
	);

	let editing = $state(false);
	let deleting = $state(false);
</script>

<svelte:head>
	<title>{milestone.title} · {data.project.name}</title>
</svelte:head>

<a href="{base}/milestones" class="btn btn-ghost btn-sm mb-5 -ml-2 text-muted">
	<ArrowLeft size={17} /> All milestones
</a>

<header class="mb-8 flex flex-wrap items-start justify-between gap-5">
	<div class="min-w-0 flex-1">
		<h1 class="text-3xl wrap-break-word sm:text-4xl">{milestone.title}</h1>
		<div class="mt-4 flex flex-wrap items-center gap-2.5">
			<Badge option={milestonePhase(milestone.phase)} />
			<Badge option={{ ...milestonePriority(milestone.priority), label: `${milestonePriority(milestone.priority).label} priority` }} />
			<span class="chip {isOverdue(milestone.due_date) ? 'text-bad' : 'text-muted'}">
				{milestone.due_date ? `Due ${formatDate(milestone.due_date)}` : 'No due date'}
			</span>
			{#if data.ownerName}<span class="chip text-muted">Owner: {data.ownerName}</span>{/if}
			{#if milestone.estimate}<span class="chip text-muted">Estimate: {milestone.estimate}</span>{/if}
		</div>
		{#if milestone.description}
			<p class="mt-5 max-w-3xl text-lg whitespace-pre-wrap text-muted">{milestone.description}</p>
		{/if}
	</div>
	{#if data.canEdit}
		<div class="flex gap-3">
			<button type="button" class="btn" onclick={() => (editing = true)}><Pencil size={18} /> Edit</button>
			<button type="button" class="btn btn-danger btn-icon" aria-label="Delete milestone" title="Delete" onclick={() => (deleting = true)}>
				<Trash size={18} />
			</button>
		</div>
	{/if}
</header>

{#if data.slices.length}
	<section class="panel mb-8 p-6">
		<div class="mb-2.5 flex items-center justify-between">
			<h2 class="text-lg">Progress</h2>
			<span class="text-muted">
				{done} of {data.slices.length} steps ·
				<strong class="text-fg tabular-nums">{percent(done, data.slices.length)}%</strong>
			</span>
		</div>
		<div class="progress" aria-hidden="true"><span style="width: {percent(done, data.slices.length)}%"></span></div>
	</section>
{/if}

<div class="grid gap-8">
	<DataSection
		title="Steps"
		noun="step"
		rows={data.slices}
		fields={stepFields}
		canEdit={data.canEdit}
		createAction="?/createSlice"
		updateAction="?/updateSlice"
		deleteAction="?/deleteSlice"
		searchFrom={15}
		columns={[
			{ key: 'title', label: 'Step', primary: true, sub: (row) => String(row.notes ?? '') },
			{ key: 'status', label: 'Status', kind: 'badge', option: sliceStatus },
			{ key: 'ownerName', label: 'Owner' },
			{ key: 'deadline', label: 'Deadline', kind: 'date' },
			{ key: 'estimate', label: 'Estimate' }
		]}
		emptyTitle="No steps yet"
		emptyMessage="Split this milestone into smaller steps to track progress."
	>
		{#snippet rowActions(row)}
			{#if data.canEdit}
				<Form action="?/sliceStatus" toast={false}>
					{#snippet children({ pending })}
						<input type="hidden" name="id" value={row.id} />
						<label>
							<span class="sr-only">Status for {row.title}</span>
							<select
								name="status"
								class="select min-h-10! w-36 py-1.5! text-[0.9rem]!"
								disabled={pending}
								onchange={(event) => event.currentTarget.form?.requestSubmit()}
							>
								{#each SLICE_STATUSES as option (option.value)}
									<option value={option.value} selected={option.value === row.status || (option.value === 'pending' && row.status === 'todo')}>
										{option.label}
									</option>
								{/each}
							</select>
						</label>
					{/snippet}
				</Form>
			{/if}
		{/snippet}
	</DataSection>

	<div class="grid gap-8 xl:grid-cols-2">
		<section class="panel">
			<header class="panel-header"><h2 class="panel-title">Related tasks</h2></header>
			<div class="p-5">
				{#if data.linkedTasks.length === 0}
					<p class="text-muted">No tasks are linked to this milestone.</p>
				{:else}
					<ul class="grid gap-2">
						{#each data.linkedTasks as task (task.id)}
							<li class="flex items-center gap-3 rounded-block bg-surface-2 py-2 pr-2 pl-4">
								<a href="{base}/tasks/{task.id}" class="min-w-0 flex-1 truncate font-medium hover:underline">{task.title}</a>
								<Badge option={taskStatus(task.status)} />
								{#if data.canEdit}
									<Form action="?/unlinkTask" toast={false}>
										{#snippet children({ pending })}
											<input type="hidden" name="id" value={task.id} />
											<button type="submit" class="btn btn-ghost btn-sm btn-icon" aria-label="Unlink {task.title}" title="Unlink" disabled={pending}>
												<X size={16} />
											</button>
										{/snippet}
									</Form>
								{/if}
							</li>
						{/each}
					</ul>
				{/if}
				{#if data.canEdit && data.taskChoices.length}
					<Form action="?/linkTask" toast={false} class="mt-4">
						{#snippet children({ pending })}
							<label class="sr-only" for="link-task">Task to link</label>
							<div class="flex gap-2">
								<select id="link-task" name="task_id" class="select min-w-0 flex-1" required>
									<option value="" selected disabled>Choose a task…</option>
									{#each data.taskChoices as option (option.value)}
										<option value={option.value}>{option.label}</option>
									{/each}
								</select>
								<button type="submit" class="btn shrink-0" disabled={pending}>Link task</button>
							</div>
						{/snippet}
					</Form>
				{/if}
			</div>
		</section>

		<section class="panel">
			<header class="panel-header"><h2 class="panel-title">Details</h2></header>
			<div class="grid gap-5 p-6">
				{#if data.canEdit}
					<div class="flex flex-wrap items-center justify-between gap-3 rounded-block bg-surface-2 p-4">
						<div>
							<p class="eyebrow">Billing</p>
							<p class="mt-1 text-xl font-bold tabular-nums">{formatMoney(milestone.amount)}</p>
						</div>
						<div class="flex items-center gap-3">
							<Badge option={milestonePaymentStatus(milestone.status)} />
							<a href="{base}/finance" class="btn btn-sm">Open finance</a>
						</div>
					</div>
				{/if}
				{#if data.specTitle}
					<div>
						<p class="eyebrow">Related spec</p>
						<p class="mt-1.5"><a href="{base}/specs" class="link">{data.specTitle}</a></p>
					</div>
				{/if}
				{#each notes as note (note.label)}
					<div>
						<p class="eyebrow">{note.label}</p>
						<p class="mt-1.5 whitespace-pre-wrap">{note.text}</p>
					</div>
				{:else}
					{#if !data.specTitle}<p class="text-muted">No extra details were added.</p>{/if}
				{/each}
			</div>
		</section>
	</div>
</div>

{#if data.canEdit}
	<RecordDialog bind:open={editing} noun="milestone" {fields} record={milestone} size="lg" />
	<ConfirmDialog
		bind:open={deleting}
		title="Delete this milestone?"
		message={`“${milestone.title}” and its steps will be permanently deleted. Payments recorded for it are kept.`}
		values={{ id: milestone.id }}
	/>
{/if}

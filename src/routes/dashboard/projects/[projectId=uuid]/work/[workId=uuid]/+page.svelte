<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Badge from '#lib/components/Badge.svelte';
	import ActionDialog from '#lib/components/ActionDialog.svelte';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import Form from '#lib/components/Form.svelte';
	import RecordDialog from '#lib/components/RecordDialog.svelte';
	import Time from '#lib/components/Time.svelte';
	import { decisionStatus, workEvent, workState } from '#lib/constants.ts';
	import type { Field } from '#lib/fields.ts';
	import { PLAN_FIELDS } from '#lib/work-rules.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const base = $derived(`/dashboard/projects/${data.project.id}`);
	const item = $derived(data.item);
	const pending = $derived(data.decisions.filter((decision) => decision.status === 'pending'));
	const decided = $derived(data.decisions.filter((decision) => decision.status !== 'pending'));
	const timeline = $derived([...data.events].reverse());
	const claimed = $derived(
		Boolean(item.claimed_by && item.claim_until && Date.parse(item.claim_until) > Date.now())
	);
	const open = $derived(item.state !== 'released' && item.state !== 'dropped');
	const ids = $derived({ id: item.id });

	let editing = $state(false);
	let checking = $state(false);
	let proposing = $state(false);
	let releasing = $state(false);
	let reopening = $state(false);
	let noting = $state(false);
	let dropping = $state(false);

	const CHECK_FIELDS: readonly Field[] = [
		{
			name: 'result',
			label: 'Result',
			type: 'select',
			required: true,
			options: [
				{ value: 'failed', label: 'Failed' },
				{ value: 'passed', label: 'Passed' }
			],
			initial: 'failed'
		},
		{ name: 'build', label: 'Build or version tested', type: 'text', required: true, max: 200, placeholder: 'v1.4.0-rc2' },
		{
			name: 'body',
			label: 'What happened',
			type: 'textarea',
			max: 8000,
			rows: 4,
			hint: 'Required for a failure. Say what you saw, so the fix starts from it.'
		}
	];
	const SCOPE_FIELDS: readonly Field[] = [
		{ name: 'proposal', label: 'What to add', type: 'textarea', required: true, max: 4000, rows: 3 },
		{ name: 'reason', label: 'Why', type: 'textarea', max: 4000, rows: 3 }
	];
	const RELEASE_FIELDS: readonly Field[] = [
		{ name: 'version', label: 'Released version', type: 'text', required: true, max: 100, placeholder: 'v1.4.0' },
		{ name: 'note', label: 'Release note', type: 'textarea', max: 8000, rows: 3 }
	];
	const REOPEN_FIELDS: readonly Field[] = [
		{ name: 'body', label: 'What went wrong again', type: 'textarea', required: true, max: 4000, rows: 4 },
		{ name: 'build', label: 'Build where you saw it', type: 'text', max: 200 }
	];
	const NOTE_FIELDS: readonly Field[] = [
		{ name: 'body', label: 'Note', type: 'textarea', required: true, max: 8000, rows: 4 },
		{ name: 'next_action', label: 'Next action', type: 'text', max: 500, wide: true }
	];
</script>

<svelte:head>
	<title>{item.title} · Work · {data.project.name}</title>
</svelte:head>

<a href="{base}/work" class="btn btn-ghost btn-sm -ml-2 mb-4 text-muted"><ArrowLeft size={17} /> All work</a>

<header class="mb-8">
	<div class="flex flex-wrap items-center gap-3">
		<Badge option={workState(item.state)} />
		<span class="chip text-muted">Plan version {item.plan_version}</span>
		{#if item.base_version}<span class="chip text-muted">Base {item.base_version}</span>{/if}
	</div>
	<h1 class="mt-4 text-3xl wrap-break-word sm:text-4xl">{item.title}</h1>
	<p class="mt-2 text-muted">
		{#if item.created_by}Created by {item.created_by} ·{/if}
		Updated <Time value={item.updated_at} relative />
	</p>
</header>

<section class="tile mb-8 grid gap-5 p-6 md:grid-cols-[1fr_auto] md:items-center">
	<div class="min-w-0">
		<p class="eyebrow">Next</p>
		<p class="mt-1 text-lg font-semibold wrap-break-word">{item.next_action || 'Nothing. This work is closed.'}</p>
		<p class="mt-1 text-muted">
			{#if claimed}
				Claimed by <strong>{item.claimed_by}</strong> until <Time value={item.claim_until} />.
			{:else if ['approved', 'in_progress', 'check_failed'].includes(item.state)}
				Nobody holds this. Any agent can claim it.
			{:else if item.state === 'idea'}
				Agents wait until you approve the plan.
			{:else if item.state === 'qa_passed'}
				The check passed on {item.qa_build}. Accept it if you are happy.
			{:else if item.state === 'released'}
				Released in {item.released_version} <Time value={item.released_at} relative />.
			{/if}
		</p>
	</div>

	{#if data.canEdit}
		<div class="flex flex-wrap gap-2 md:justify-end">
			{#if item.state === 'idea'}
				<button type="button" class="btn" onclick={() => (editing = true)}>Edit plan</button>
				<Form action="?/approve">
					{#snippet children({ pending: busy })}
						<input type="hidden" name="id" value={item.id} />
						<button type="submit" class="btn btn-primary" disabled={busy}>Approve plan</button>
					{/snippet}
				</Form>
			{:else if item.state === 'qa_passed'}
				<button type="button" class="btn" onclick={() => (checking = true)}>It failed</button>
				<Form action="?/accept">
					{#snippet children({ pending: busy })}
						<input type="hidden" name="id" value={item.id} />
						<button type="submit" class="btn btn-primary" disabled={busy}>Accept</button>
					{/snippet}
				</Form>
			{:else if item.state === 'accepted'}
				<button type="button" class="btn" onclick={() => (checking = true)}>It failed</button>
				<button type="button" class="btn btn-primary" onclick={() => (releasing = true)}>Mark released</button>
			{:else if item.state === 'released'}
				<button type="button" class="btn" onclick={() => (reopening = true)}>It broke again</button>
			{:else if open}
				<button type="button" class="btn" onclick={() => (editing = true)}>Change plan</button>
				<button type="button" class="btn" onclick={() => (checking = true)}>Record check</button>
				{#if claimed}
					<Form action="?/handoff">
						{#snippet children({ pending: busy })}
							<input type="hidden" name="id" value={item.id} />
							<input type="hidden" name="note" value="Claim released from Mint." />
							<button type="submit" class="btn" disabled={busy}>Release claim</button>
						{/snippet}
					</Form>
				{/if}
			{/if}
		</div>
	{/if}
</section>

{#if pending.length}
	<section class="mb-8">
		<h2 class="mb-3 text-xl">Scope changes waiting for you</h2>
		<ul class="grid gap-3">
			{#each pending as decision (decision.id)}
				<li class="tile p-5">
					<p class="text-[0.85rem] font-semibold text-muted">
						{decision.proposed_by || 'Someone'} · <Time value={decision.created_at} relative />
					</p>
					<p class="mt-1 font-semibold whitespace-pre-line wrap-break-word">{decision.proposal}</p>
					{#if decision.reason}<p class="mt-1 text-muted whitespace-pre-line wrap-break-word">{decision.reason}</p>{/if}
					{#if data.canEdit}
						<Form action="?/decide" class="mt-4 flex flex-wrap gap-2">
							{#snippet children({ pending: busy })}
								<input type="hidden" name="decision" value={decision.id} />
								<button type="submit" name="status" value="approved" class="btn btn-primary btn-sm" disabled={busy}>
									Approve as new work
								</button>
								<button type="submit" name="status" value="deferred" class="btn btn-outline btn-sm" disabled={busy}>
									Later
								</button>
								<button type="submit" name="status" value="rejected" class="btn btn-ghost btn-sm" disabled={busy}>
									Reject
								</button>
							{/snippet}
						</Form>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
{/if}

<div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
	<div class="grid content-start gap-6">
		<section class="panel">
			<div class="panel-header"><h2 class="panel-title">Outcome</h2></div>
			<div class="panel-body whitespace-pre-wrap wrap-break-word">{item.outcome || 'Not written yet.'}</div>
		</section>
		<section class="panel">
			<div class="panel-header"><h2 class="panel-title">Plan</h2></div>
			<div class="panel-body mono text-[0.92rem] whitespace-pre-wrap wrap-break-word">{item.plan || 'Not written yet.'}</div>
		</section>
		<section class="panel">
			<div class="panel-header"><h2 class="panel-title">Acceptance criteria</h2></div>
			<div class="panel-body whitespace-pre-wrap wrap-break-word">{item.acceptance || 'Not written yet.'}</div>
		</section>

		<section>
			<h2 class="mb-3 text-xl">What happened</h2>
			{#if timeline.length === 0}
				<p class="text-muted">Nothing yet.</p>
			{:else}
				<ol class="list">
					{#each timeline as event (event.id)}
						<li class="list-row items-start">
							<span class="min-w-0 flex-1">
								<span class="flex flex-wrap items-center gap-2">
									<Badge option={workEvent(event.kind)} />
									<span class="text-[0.9rem] text-muted">
										{event.actor || 'Someone'}{event.via === 'api' ? ' (agent)' : ''} ·
										<Time value={event.created_at} relative />
										{#if event.build}· {event.build}{/if}
									</span>
								</span>
								{#if event.body}
									<span class="mt-2 block whitespace-pre-line wrap-break-word">{event.body}</span>
								{/if}
							</span>
						</li>
					{/each}
				</ol>
			{/if}
		</section>
	</div>

	<aside class="grid content-start gap-6">
		<section class="panel">
			<div class="panel-header"><h2 class="panel-title">Facts</h2></div>
			<dl class="panel-body grid gap-3 text-[0.95rem]">
				<div>
					<dt class="text-muted">Approved</dt>
					<dd>
						{#if item.approved_at}{item.approved_by} · <Time value={item.approved_at} relative />{:else}Not yet{/if}
					</dd>
				</div>
				<div>
					<dt class="text-muted">Check passed</dt>
					<dd>
						{#if item.qa_passed_at}{item.qa_build} · <Time value={item.qa_passed_at} relative />{:else}Not yet{/if}
					</dd>
				</div>
				<div>
					<dt class="text-muted">Accepted</dt>
					<dd>
						{#if item.accepted_at}{item.accepted_by} · <Time value={item.accepted_at} relative />{:else}Not yet{/if}
					</dd>
				</div>
				<div>
					<dt class="text-muted">Released</dt>
					<dd>{item.released_version ?? 'Not yet'}</dd>
				</div>
			</dl>
		</section>

		{#if data.follows || data.followUps.length}
			<section class="panel">
				<div class="panel-header"><h2 class="panel-title">Related work</h2></div>
				<ul class="panel-body grid gap-3">
					{#if data.follows}
						<li>
							<span class="block text-[0.85rem] text-muted">Follows</span>
							<a href="{base}/work/{data.follows.id}" class="link">{data.follows.title}</a>
						</li>
					{/if}
					{#each data.followUps as next (next.id)}
						<li>
							<span class="block text-[0.85rem] text-muted">Led to · {workState(next.state).label}</span>
							<a href="{base}/work/{next.id}" class="link">{next.title}</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if decided.length}
			<section class="panel">
				<div class="panel-header"><h2 class="panel-title">Decided scope</h2></div>
				<ul class="panel-body grid gap-3">
					{#each decided as decision (decision.id)}
						<li class="grid gap-1">
							<Badge option={decisionStatus(decision.status)} />
							<span class="wrap-break-word">{decision.proposal}</span>
							{#if decision.result_work_id}
								<a href="{base}/work/{decision.result_work_id}" class="link text-[0.9rem]">Open the new work</a>
							{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if data.canEdit && open}
			<section class="grid gap-2">
				<button type="button" class="btn btn-block" onclick={() => (noting = true)}>Add a note</button>
				<button type="button" class="btn btn-block" onclick={() => (proposing = true)}>Propose a scope change</button>
				<button type="button" class="btn btn-block btn-ghost text-bad" onclick={() => (dropping = true)}>Drop this work</button>
			</section>
		{/if}
	</aside>
</div>

<RecordDialog
	bind:open={editing}
	noun="plan"
	fields={PLAN_FIELDS}
	record={{ ...item }}
	updateAction="?/edit"
	size="lg"
>
	{#snippet extra()}
		{#if item.state !== 'idea'}
			<p class="notice notice-warn mt-6">
				This plan is already approved. Saving makes plan version {item.plan_version + 1}, releases any claim, and
				waits for you to approve it again.
			</p>
		{/if}
	{/snippet}
</RecordDialog>

<ActionDialog
	bind:open={checking}
	title="Record a check"
	action="?/check"
	fields={CHECK_FIELDS}
	values={ids}
	intro="A failure sends the work back to the queue with your reason as the next action. A pass waits for you to accept it."
	submitLabel="Save check"
/>
<ActionDialog
	bind:open={proposing}
	title="Propose a scope change"
	action="?/scope"
	fields={SCOPE_FIELDS}
	values={ids}
	intro="Approving it later makes it a separate piece of work, so this one can still finish on its plan."
	submitLabel="Propose"
/>
<ActionDialog
	bind:open={releasing}
	title="Mark released"
	action="?/release"
	fields={RELEASE_FIELDS}
	values={ids}
	submitLabel="Mark released"
/>
<ActionDialog
	bind:open={reopening}
	title="It broke again"
	action="?/reopen"
	fields={REOPEN_FIELDS}
	values={ids}
	intro="This opens new work that follows this one, waiting for your approval. The history stays linked."
	submitLabel="Open follow-up"
/>
<ActionDialog bind:open={noting} title="Add a note" action="?/note" fields={NOTE_FIELDS} values={ids} submitLabel="Add note" />
<ConfirmDialog
	bind:open={dropping}
	title="Drop this work?"
	message="Agents stop seeing it and it leaves your lists. The history stays."
	action="?/drop"
	values={ids}
	confirmLabel="Drop"
	note=""
/>

<script lang="ts">
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import ClipboardCheck from '@lucide/svelte/icons/clipboard-check';
	import Clock from '@lucide/svelte/icons/clock';
	import GitPullRequestArrow from '@lucide/svelte/icons/git-pull-request-arrow';
	import Form from '#lib/components/Form.svelte';
	import Time from '#lib/components/Time.svelte';

	interface Card {
		kind: 'approve' | 'decide' | 'accept' | 'stale';
		workId: string;
		projectId: string;
		title: string;
		detail: string;
		since: string;
		decisionId?: string;
	}

	interface Props {
		cards: Card[];
		canEdit: boolean;
		/** Shown above each card when the list spans several projects. */
		projectNames?: Record<string, string>;
	}

	let { cards, canEdit, projectNames }: Props = $props();

	const kinds = {
		approve: { label: 'Approve the plan', icon: ClipboardCheck },
		decide: { label: 'Decide a scope change', icon: GitPullRequestArrow },
		accept: { label: 'Accept the result', icon: CircleCheck },
		stale: { label: 'Nobody picked it up', icon: Clock }
	};

	const projectPath = (card: Card) => `/dashboard/projects/${card.projectId}`;
	const workPath = (card: Card) => `${projectPath(card)}/work/${card.workId}`;
</script>

<ul class="grid gap-3">
	{#each cards as card (card.kind + card.workId + (card.decisionId ?? ''))}
		{@const kind = kinds[card.kind]}
		<li class="tile flex flex-wrap items-start gap-4 p-5">
			<span class="flex size-10 shrink-0 items-center justify-center rounded-block bg-surface-2">
				<kind.icon size={20} />
			</span>
			<div class="min-w-0 flex-1">
				<p class="text-[0.82rem] font-semibold text-muted">
					{#if projectNames?.[card.projectId]}{projectNames[card.projectId]} · {/if}{kind.label} ·
					<Time value={card.since} relative />
				</p>
				<a href={workPath(card)} class="mt-1 block text-lg leading-snug font-semibold wrap-break-word">{card.title}</a>
				<p class="mt-1 text-muted wrap-break-word whitespace-pre-line">{card.detail}</p>
			</div>
			{#if canEdit}
				<div class="flex flex-wrap items-center gap-2">
					{#if card.kind === 'approve'}
						<a href={workPath(card)} class="btn btn-ghost btn-sm">Read plan</a>
						<Form action="{projectPath(card)}?/approve">
							{#snippet children({ pending })}
								<input type="hidden" name="id" value={card.workId} />
								<button type="submit" class="btn btn-primary btn-sm" disabled={pending}>Approve</button>
							{/snippet}
						</Form>
					{:else if card.kind === 'decide'}
						<Form action="{projectPath(card)}?/decide" class="flex flex-wrap gap-2">
							{#snippet children({ pending })}
								<input type="hidden" name="decision" value={card.decisionId} />
								<button type="submit" name="status" value="rejected" class="btn btn-ghost btn-sm" disabled={pending}>
									Reject
								</button>
								<button type="submit" name="status" value="deferred" class="btn btn-outline btn-sm" disabled={pending}>
									Later
								</button>
								<button type="submit" name="status" value="approved" class="btn btn-primary btn-sm" disabled={pending}>
									Approve
								</button>
							{/snippet}
						</Form>
					{:else if card.kind === 'accept'}
						<a href={workPath(card)} class="btn btn-ghost btn-sm">See checks</a>
						<Form action="{projectPath(card)}?/accept">
							{#snippet children({ pending })}
								<input type="hidden" name="id" value={card.workId} />
								<button type="submit" class="btn btn-primary btn-sm" disabled={pending}>Accept</button>
							{/snippet}
						</Form>
					{:else}
						<a href={workPath(card)} class="btn btn-outline btn-sm">Open</a>
					{/if}
				</div>
			{/if}
		</li>
	{/each}
</ul>

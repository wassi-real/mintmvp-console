<script lang="ts">
	import Bot from '@lucide/svelte/icons/bot';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Plus from '@lucide/svelte/icons/plus';
	import Badge from '#lib/components/Badge.svelte';
	import NeedsYou from '#lib/components/NeedsYou.svelte';
	import Time from '#lib/components/Time.svelte';
	import { decisionStatus, projectStatus, workState } from '#lib/constants.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const base = $derived(`/dashboard/projects/${data.project.id}`);
	const links = $derived(
		[
			{ label: 'Live site', url: data.project.production_url },
			{ label: 'Staging', url: data.project.staging_url },
			{ label: 'Repository', url: data.project.repo_url }
		].filter((link): link is { label: string; url: string } => Boolean(link.url))
	);
	const today = $derived(data.board);
</script>

<svelte:head>
	<title>Today · {data.project.name}</title>
</svelte:head>

<header class="mb-10 flex flex-wrap items-start justify-between gap-5">
	<div class="min-w-0">
		<div class="flex flex-wrap items-center gap-3">
			<Badge option={projectStatus(data.project.status)} />
			{#each links as link (link.label)}
				<a href={link.url} target="_blank" rel="noreferrer" class="chip text-muted">
					{link.label} <ExternalLink size={13} />
				</a>
			{/each}
		</div>
		<h1 class="mt-4 text-4xl sm:text-5xl">Today</h1>
		<p class="mt-3 max-w-3xl text-lg text-muted">
			What needs you, what your agents are doing without you, and why anything slipped.
		</p>
	</div>
	{#if data.canEdit}
		<a href="{base}/work?new=1" class="btn btn-primary"><Plus size={18} /> New work</a>
	{/if}
</header>

{#if !today.ready}
	<p class="notice notice-warn mb-8">
		The work loop is not in the database yet. Apply the migration
		<code class="mono">20261125120000_work_loop_and_api_limits.sql</code> in the Supabase SQL editor, then refresh.
	</p>
{:else if data.canEdit && !data.hasAgentKey}
	<div class="tile mb-8 flex flex-wrap items-center gap-4 p-5">
		<span class="flex size-10 shrink-0 items-center justify-center rounded-block bg-accent text-accent-fg">
			<Bot size={20} />
		</span>
		<div class="min-w-0 flex-1">
			<p class="font-semibold">Connect your agent</p>
			<p class="text-muted">Create a key and paste one prompt into Claude Code, Cursor or Codex. It does the rest.</p>
		</div>
		<a href="{base}/api-keys" class="btn btn-primary btn-sm">Connect agent</a>
	</div>
{/if}

<section class="mb-12" aria-labelledby="needs-you">
	<div class="mb-4 flex items-baseline gap-3">
		<h2 id="needs-you" class="text-2xl">Needs you</h2>
		{#if today.needsYou.length}
			<span class="rounded-full bg-bad px-2.5 py-0.5 text-[0.8rem] font-bold text-bg tabular-nums">
				{today.needsYou.length}
			</span>
		{/if}
	</div>
	{#if today.needsYou.length === 0}
		<p class="tile p-5 text-muted">
			Nothing needs you right now. Plans to approve, scope changes to decide and results to accept show up here.
		</p>
	{:else}
		<NeedsYou cards={today.needsYou} canEdit={data.canEdit} />
	{/if}
</section>

<section class="mb-12" aria-labelledby="moving">
	<h2 id="moving" class="mb-1 text-2xl">Moving without you</h2>
	<p class="mb-4 text-muted">Claimed work, work any agent can pick up, and accepted work waiting for release.</p>
	{#if today.moving.length === 0}
		<p class="tile p-5 text-muted">
			Nothing is moving. Approve a plan to give your agents something to do.
		</p>
	{:else}
		<div class="list">
			{#each today.moving as card (card.workId)}
				<a href="{base}/work/{card.workId}" class="list-row flex-wrap">
					<span class="min-w-0 flex-1">
						<span class="block font-semibold wrap-break-word">{card.title}</span>
						<span class="block text-[0.9rem] text-muted wrap-break-word">
							{card.detail}
							{#if card.until}Until <Time value={card.until} relative />.{/if}
							Next: {card.next}
						</span>
					</span>
					<Badge option={workState(card.state)} />
				</a>
			{/each}
		</div>
	{/if}
</section>

<section aria-labelledby="slipped">
	<h2 id="slipped" class="mb-1 text-2xl">Why it slipped</h2>
	<p class="mb-4 text-muted">Failed checks, scope that was pushed out, and problems seen again after release. Last 45 days.</p>
	{#if today.slipped.length === 0}
		<p class="tile p-5 text-muted">Nothing slipped. When a check fails or scope is deferred, the reason lands here.</p>
	{:else}
		<ul class="grid gap-3">
			{#each today.slipped as card (card.workId)}
				<li class="tile p-5">
					<div class="flex flex-wrap items-center gap-3">
						<a href="{base}/work/{card.workId}" class="min-w-0 flex-1 text-lg font-semibold wrap-break-word">
							{card.title}
						</a>
						<Badge option={workState(card.state)} />
					</div>
					{#if card.follows}
						<p class="mt-1 text-[0.9rem] text-muted">
							Follows <a href="{base}/work/{card.follows.id}" class="link">{card.follows.title}</a>
						</p>
					{/if}
					<ul class="mt-3 grid gap-2">
						{#each card.failures as failure, i (failure.at + i)}
							<li class="flex flex-wrap gap-x-2 text-[0.95rem]">
								<span class="font-semibold text-bad">Failed{failure.build ? ` on ${failure.build}` : ''}:</span>
								<span class="min-w-0 flex-1 wrap-break-word">{failure.body || 'No detail given.'}</span>
								<span class="text-muted">{failure.actor} · <Time value={failure.at} relative /></span>
							</li>
						{/each}
						{#each card.deferred as item, i (item.proposal + i)}
							<li class="flex flex-wrap items-center gap-2 text-[0.95rem]">
								<Badge option={decisionStatus(item.status)} />
								<span class="min-w-0 flex-1 wrap-break-word">{item.proposal}</span>
							</li>
						{/each}
					</ul>
					{#if card.fixedBuild}
						<p class="mt-3 text-[0.9rem] font-semibold text-ok">Fixed and checked on {card.fixedBuild}.</p>
					{/if}
					{#if card.released}
						<p class="mt-1 text-[0.9rem] text-muted">Released in {card.released}.</p>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>

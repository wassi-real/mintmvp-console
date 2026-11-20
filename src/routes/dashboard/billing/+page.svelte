<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Form from '#lib/components/Form.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { formatDate } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const free = [
		'Look at everything in the workspace',
		'2 projects in a workspace',
		'Each month, per project: 30 tasks, 3 milestones, 5 reports, 3 specs and 5 incidents',
		'No MintAI'
	];
	const premium = [
		'Unlimited projects, tasks, milestones and incidents',
		'Each month, per project: 40 reports and 20 specs',
		'MintAI inside every project: create, edit, delete and read',
		'100 MintAI requests a month, and your chats are saved'
	];
</script>

<svelte:head>
	<title>Premium · {data.workspace.name}</title>
</svelte:head>

<PageHeader
	title="Premium"
	description="Premium is $5 a month for your account. It unlocks MintAI and removes the tight free limits."
/>

{#if data.checkout === 'success'}
	<p class="notice notice-ok mb-8" role="status">
		Payment received. Premium turns on as soon as Stripe confirms it, usually within a few seconds.
		Refresh this page if it still says Free.
	</p>
{/if}
{#if data.checkout === 'cancel'}
	<p class="notice mb-8" role="status">Checkout was cancelled. You have not been charged.</p>
{/if}

<div class="grid gap-6 lg:grid-cols-2">
	<section class="panel p-7 {data.plan.premium ? '' : 'border-fg'}">
		<p class="eyebrow">{data.plan.premium ? 'Your plan' : 'Current plan'}</p>
		<h2 class="mt-2 text-3xl">{data.plan.premium ? 'Premium' : 'Free'}</h2>
		{#if data.plan.premium}
			<p class="mt-2 text-muted">
				{#if data.subscription?.currentPeriodEnd}
					Renews or ends {formatDate(data.subscription.currentPeriodEnd)}.
				{:else}
					Your subscription is active.
				{/if}
				MintAI: {data.plan.remaining} of 100 requests left this month.
			</p>
		{:else}
			<p class="mt-2 text-muted">MintAI stays locked until you subscribe.</p>
		{/if}
		<ul class="mt-6 grid gap-3">
			{#each data.plan.premium ? premium : free as item (item)}
				<li class="flex gap-3"><Check size={18} class="mt-1 shrink-0" /> {item}</li>
			{/each}
		</ul>
	</section>

	<section class="panel p-7">
		<div class="flex items-center gap-3">
			<span class="flex size-12 items-center justify-center rounded-block bg-accent text-accent-fg">
				<Sparkles size={22} />
			</span>
			<div>
				<h2 class="text-2xl">Premium</h2>
				<p class="text-muted">$5 per month, cancel any time</p>
			</div>
		</div>
		<ul class="mt-6 grid gap-3">
			{#each premium as item (item)}
				<li class="flex gap-3"><Check size={18} class="mt-1 shrink-0 text-ok" /> {item}</li>
			{/each}
		</ul>

		{#if !data.plan.ready}
			<p class="notice notice-warn mt-6">
				The billing tables are not in the database yet. Apply the migration
				<code class="mono">20261120180000_premium_and_mintai.sql</code> in the Supabase SQL editor, then refresh.
			</p>
		{/if}
		{#if !data.stripeReady}
			<p class="notice mt-6">
				Add <span class="mono">STRIPE_SECRET_KEY</span> and
				<span class="mono">STRIPE_WEBHOOK_SECRET</span> to the server environment. A Stripe test key is enough for now.
				Point the webhook at <span class="mono">/api/stripe/webhook</span>.
			</p>
		{/if}

		<div class="mt-7 flex flex-wrap gap-3">
			{#if data.plan.premium}
				<Form action="?/portal">
					{#snippet children({ pending })}
						<button type="submit" class="btn btn-primary" disabled={pending || !data.stripeReady}>
							{pending ? 'Opening…' : 'Manage subscription'}
						</button>
					{/snippet}
				</Form>
			{:else}
				<Form action="?/checkout">
					{#snippet children({ pending })}
						<button type="submit" class="btn btn-primary btn-lg" disabled={pending || !data.stripeReady || !data.plan.ready}>
							{pending ? 'Opening checkout…' : 'Subscribe for $5 a month'}
						</button>
					{/snippet}
				</Form>
			{/if}
		</div>
		<p class="mt-4 text-[0.9rem] text-muted">
			The charge is on your account, not the workspace. Other people still need their own Premium to use MintAI.
			MintAI also needs <span class="mono">ANTHROPIC_API_KEY</span>.
		</p>
	</section>
</div>

<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Form from '#lib/components/Form.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { formatDate } from '#lib/format.ts';
	import { PLANS, formatLimit, planOf, type Plan } from '#lib/plans.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	function perks(plan: Plan): string[] {
		return [
			plan.projects === null ? 'Unlimited projects' : `${plan.projects} project in a workspace`,
			plan.workPerMonth === null
				? 'Unlimited work items'
				: `${plan.workPerMonth} new work items per project each month`,
			`API: ${plan.apiPerMinute} requests a minute for each key`,
			`API: ${formatLimit(plan.apiWritesPerMonth)} writes per project each month. Reads are not capped.`,
			plan.price === 0
				? '30 tasks and 5 reports per project each month, plus monitoring'
				: 'Unlimited tasks, 40 reports per project each month, plus monitoring'
		];
	}

	const current = $derived(planOf(data.plan.premium));
</script>

<svelte:head>
	<title>Plan · {data.workspace.name}</title>
</svelte:head>

<PageHeader
	title="Plan"
	description="Free covers one project. Mint is $5 a month for unlimited projects and more room for your agents."
/>

{#if data.checkout === 'success'}
	<p class="notice notice-ok mb-8" role="status">
		Payment received. Mint turns on as soon as Stripe confirms it, usually within a few seconds. Refresh this
		page if it still says Free.
	</p>
{/if}
{#if data.checkout === 'cancel'}
	<p class="notice mb-8" role="status">Checkout was cancelled. You have not been charged.</p>
{/if}

<div class="grid gap-6 lg:grid-cols-2">
	<section class="panel p-7 {data.plan.premium ? '' : 'border-fg'}">
		<p class="eyebrow">Your plan</p>
		<h2 class="mt-2 text-3xl">{current.name}</h2>
		<p class="mt-2 text-muted">
			{#if data.plan.premium}
				{#if data.subscription?.currentPeriodEnd}
					Renews or ends {formatDate(data.subscription.currentPeriodEnd)}.
				{:else}
					Your subscription is active.
				{/if}
			{:else}
				Free for as long as you like.
			{/if}
		</p>
		<ul class="mt-6 grid gap-3">
			{#each perks(current) as item (item)}
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
				<h2 class="text-2xl">{PLANS.mint.name}</h2>
				<p class="text-muted">${PLANS.mint.price} per month, cancel any time</p>
			</div>
		</div>
		<ul class="mt-6 grid gap-3">
			{#each perks(PLANS.mint) as item (item)}
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
							{pending ? 'Opening checkout…' : `Upgrade for $${PLANS.mint.price} a month`}
						</button>
					{/snippet}
				</Form>
			{/if}
		</div>
		<p class="mt-4 text-[0.9rem] text-muted">
			The plan belongs to your account. API keys in a workspace use the plan of the workspace owner.
		</p>
	</section>
</div>

<section class="mt-10">
	<h2 class="mb-2 text-xl">Agent traffic this month</h2>
	<p class="mb-5 text-muted">
		Writes count toward the monthly limit of {formatLimit(current.apiWritesPerMonth)} per project. Reads are counted
		but never blocked.
	</p>
	{#if !data.usageReady}
		<p class="notice notice-warn">
			API usage is not tracked yet. Apply the migration
			<code class="mono">20261125120000_work_loop_and_api_limits.sql</code> in the Supabase SQL editor.
		</p>
	{:else if data.usage.length === 0}
		<p class="text-muted">No projects yet.</p>
	{:else}
		<div class="table-wrap">
			<table class="table">
				<thead>
					<tr>
						<th>Project</th>
						<th class="text-right">Writes</th>
						<th class="text-right">Reads</th>
						<th>Room left</th>
					</tr>
				</thead>
				<tbody>
					{#each data.usage as row (row.id)}
						{@const share = Math.min(row.writes / current.apiWritesPerMonth, 1)}
						<tr>
							<td><a href="/dashboard/projects/{row.id}/api-keys" class="font-semibold">{row.name}</a></td>
							<td class="mono text-right">{row.writes.toLocaleString('en-US')}</td>
							<td class="mono text-right">{row.reads.toLocaleString('en-US')}</td>
							<td class="min-w-40">
								<span class="progress block">
									<span
										class={share >= 0.9 ? 'bg-bad' : share >= 0.7 ? 'bg-warn' : ''}
										style="width: {Math.max(share * 100, row.writes ? 2 : 0)}%"
									></span>
								</span>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>

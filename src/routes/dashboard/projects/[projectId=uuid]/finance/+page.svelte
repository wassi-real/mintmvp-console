<script lang="ts">
	import Pencil from '@lucide/svelte/icons/pencil';
	import Badge from '#lib/components/Badge.svelte';
	import RecordDialog from '#lib/components/RecordDialog.svelte';
	import DataSection from '#lib/components/DataSection.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Stat from '#lib/components/Stat.svelte';
	import { expenseCategory, milestonePaymentStatus, paymentMethod } from '#lib/constants.ts';
	import { formatMoney } from '#lib/format.ts';
	import { expenseFields, milestoneBillingFields, paymentFields } from '#lib/sections.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const billed = $derived(data.milestones.reduce((sum, milestone) => sum + milestone.amount, 0));
	const received = $derived(data.payments.reduce((sum, payment) => sum + payment.amount, 0));
	const spent = $derived(data.expenses.reduce((sum, expense) => sum + expense.amount, 0));
	const outstanding = $derived(
		data.milestones
			.filter((milestone) => milestone.status !== 'paid')
			.reduce((sum, milestone) => sum + milestone.amount, 0)
	);

	const names = $derived(new Map(data.milestones.map((milestone) => [milestone.id, milestone.title])));
	const paymentRows = $derived(
		data.payments.map((payment) => ({
			...payment,
			milestoneName: payment.milestone_id ? (names.get(payment.milestone_id) ?? 'Removed milestone') : ''
		}))
	);

	let editing = $state<(typeof data.milestones)[number] | null>(null);
	let editOpen = $state(false);
</script>

<svelte:head>
	<title>Finance · {data.project.name}</title>
</svelte:head>

<PageHeader
	title="Finance"
	description="What this project is billed for, what has been paid, and what it has cost."
/>

<div class="stagger mb-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
	<Stat label="Billed" value={formatMoney(billed)} detail="Across all milestones" />
	<Stat label="Received" value={formatMoney(received)} tone={received ? 'ok' : 'neutral'} />
	<Stat label="Still to collect" value={formatMoney(outstanding)} tone={outstanding ? 'warn' : 'neutral'} />
	<Stat label="Spent" value={formatMoney(spent)} detail={`Left over ${formatMoney(received - spent)}`} />
</div>

<div class="grid gap-8">
	<section class="panel">
		<header class="panel-header">
			<h2 class="panel-title flex items-center gap-3">
				Milestone billing <span class="chip text-muted tabular-nums">{data.milestones.length}</span>
			</h2>
		</header>
		{#if data.milestones.length === 0}
			<p class="px-6 py-10 text-center text-muted">
				Add milestones first. Each one can carry an amount and a payment status.
			</p>
		{:else}
			<div class="table-wrap">
				<table class="table">
					<thead>
						<tr>
							<th scope="col">Milestone</th>
							<th scope="col">Payment</th>
							<th scope="col">Due</th>
							<th scope="col">Paid</th>
							<th scope="col" class="text-right!">Amount</th>
							<th scope="col"><span class="sr-only">Actions</span></th>
						</tr>
					</thead>
					<tbody>
						{#each data.milestones as milestone (milestone.id)}
							<tr>
								<td>
									<a href="/dashboard/projects/{data.project.id}/milestones/{milestone.id}" class="link font-semibold">
										{milestone.title}
									</a>
								</td>
								<td><Badge option={milestonePaymentStatus(milestone.status)} /></td>
								<td class="whitespace-nowrap">{milestone.due_date ?? '—'}</td>
								<td class="whitespace-nowrap">{milestone.paid_date ?? '—'}</td>
								<td class="text-right font-semibold tabular-nums">{formatMoney(milestone.amount)}</td>
								<td class="w-px">
									<button
										type="button"
										class="btn btn-ghost btn-sm btn-icon"
										aria-label="Edit billing for {milestone.title}"
										title="Edit billing"
										onclick={() => {
											editing = milestone;
											editOpen = true;
										}}
									>
										<Pencil size={17} />
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>

	<DataSection
		title="Payments received"
		noun="payment"
		rows={paymentRows}
		fields={paymentFields({ milestones: data.milestoneChoices })}
		canEdit={data.canEdit}
		createAction="?/createPayment"
		updateAction="?/updatePayment"
		deleteAction="?/deletePayment"
		titleKey="milestoneName"
		columns={[
			{ key: 'amount', label: 'Amount', kind: 'money', primary: true, sub: (row) => String(row.notes ?? '') },
			{ key: 'milestoneName', label: 'Milestone' },
			{ key: 'payment_method', label: 'Paid with', kind: 'badge', option: paymentMethod },
			{ key: 'paid_at', label: 'Date', kind: 'date' }
		]}
		emptyTitle="No payments recorded"
		emptyMessage="Record a payment when money comes in."
	/>

	<DataSection
		title="Expenses"
		noun="expense"
		rows={data.expenses}
		fields={expenseFields}
		canEdit={data.canEdit}
		createAction="?/createExpense"
		updateAction="?/updateExpense"
		deleteAction="?/deleteExpense"
		columns={[
			{ key: 'title', label: 'Expense', primary: true, sub: (row) => String(row.notes ?? '') },
			{ key: 'category', label: 'Category', kind: 'badge', option: expenseCategory },
			{ key: 'spent_at', label: 'Date', kind: 'date' },
			{ key: 'amount', label: 'Amount', kind: 'money' }
		]}
		emptyTitle="No expenses recorded"
		emptyMessage="Record hosting, tools and other costs so the project’s margin stays visible."
	/>
</div>

{#key editing?.id}
	<RecordDialog
		bind:open={editOpen}
		noun="billing"
		fields={milestoneBillingFields}
		record={editing}
		createAction="?/billing"
		updateAction="?/billing"
	/>
{/key}

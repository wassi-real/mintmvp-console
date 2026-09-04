<script lang="ts">
	import { enhance } from '$app/forms';
	import Modal from '$lib/components/Modal.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import PageTitleBar from '$lib/components/PageTitleBar.svelte';
	import {
		Plus,
		Pencil,
		Trash2,
		CreditCard,
		Receipt,
		CircleDollarSign,
		AlertTriangle
	} from 'lucide-svelte';
	import type { Tables } from '$lib/supabase/types';

	let { data } = $props();

	type Tab = 'overview' | 'payments' | 'expenses';
	let activeTab: Tab = $state('overview');

	const totalBudget = $derived(data.milestones.reduce((s, m) => s + Number(m.amount), 0));
	const totalPaid = $derived(data.payments.reduce((s, p) => s + Number(p.amount), 0));
	const totalExpenses = $derived(data.expenses.reduce((s, e) => s + Number(e.amount), 0));
	const pendingPayment = $derived(
		data.milestones
			.filter((m) => m.status === 'ready_for_payment')
			.reduce((s, m) => s + Number(m.amount), 0)
	);
	const nextMilestoneAmount = $derived(
		(() => {
			const upcoming = data.milestones
				.filter((m) => m.status === 'active' || m.status === 'planned')
				.sort((a, b) => {
					if (!a.due_date) return 1;
					if (!b.due_date) return -1;
					return a.due_date.localeCompare(b.due_date);
				});
			return upcoming.length > 0 ? Number(upcoming[0].amount) : 0;
		})()
	);
	const paidMilestones = $derived(data.milestones.filter((m) => m.status === 'paid').length);
	const unpaidMilestones = $derived(data.milestones.filter((m) => m.status !== 'paid').length);
	const outstanding = $derived(Math.max(0, totalBudget - totalPaid));
	const paidPct = $derived(totalBudget > 0 ? Math.min(100, (totalPaid / totalBudget) * 100) : 0);
	const openMilestones = $derived(data.milestones.filter((m) => m.status !== 'paid'));

	const summary = $derived([
		{ label: 'Total budget', value: fmt(totalBudget), tone: 'text-foreground' },
		{ label: 'Total paid', value: fmt(totalPaid), tone: 'text-success' },
		{
			label: 'Outstanding',
			value: fmt(outstanding),
			tone: outstanding > 0 ? 'text-warning' : 'text-foreground'
		},
		{ label: 'Total expenses', value: fmt(totalExpenses), tone: 'text-destructive' },
		{
			label: 'Pending payment',
			value: fmt(pendingPayment),
			tone: pendingPayment > 0 ? 'text-warning' : 'text-foreground'
		},
		{
			label: 'Next milestone',
			value: nextMilestoneAmount > 0 ? fmt(nextMilestoneAmount) : '--',
			tone: 'text-foreground'
		},
		{ label: 'Paid milestones', value: String(paidMilestones), tone: 'text-success' },
		{
			label: 'Unpaid milestones',
			value: String(unpaidMilestones),
			tone: unpaidMilestones > 0 ? 'text-warning' : 'text-foreground'
		}
	]);

	function fmt(n: number) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
	}

	function fmtDate(d: string | null) {
		if (!d) return '--';
		return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function milestoneName(id: string | null): string {
		if (!id) return '';
		const m = data.milestones.find((ms) => ms.id === id);
		return m ? m.title : '';
	}

	function delay(i: number) {
		return `${Math.min(i, 8) * 40}ms`;
	}

	let payCreateOpen = $state(false);
	let payEditOpen = $state(false);
	let payDeleteOpen = $state(false);
	let payEditing: Tables<'payments'> | null = $state(null);
	let payDeletingId = $state('');

	let expCreateOpen = $state(false);
	let expEditOpen = $state(false);
	let expDeleteOpen = $state(false);
	let expEditing: Tables<'expenses'> | null = $state(null);
	let expDeletingId = $state('');

	const PAYMENT_METHODS = ['wise', 'bank_transfer', 'paypal', 'stripe', 'cash', 'other'] as const;
	const EXPENSE_CATEGORIES = [
		'developer',
		'hosting',
		'domain',
		'api_credits',
		'design',
		'marketing',
		'other'
	] as const;

	const tabs = $derived([
		{ id: 'overview' as Tab, label: 'Overview', icon: CircleDollarSign, count: undefined },
		{ id: 'payments' as Tab, label: 'Payments', icon: CreditCard, count: data.payments.length },
		{ id: 'expenses' as Tab, label: 'Expenses', icon: Receipt, count: data.expenses.length }
	]);

	const fieldClass =
		'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none';
	const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground';
</script>

<PageTitleBar title="Finance">
	{#snippet meta()}
		<span class="tabular-nums">{fmt(totalBudget)} budget</span>
		<span class="text-muted-foreground/40">·</span>
		<span class="tabular-nums text-success">{fmt(totalPaid)} paid</span>
		<span class="text-muted-foreground/40">·</span>
		<span class="tabular-nums {outstanding > 0 ? 'text-warning' : ''}"
			>{fmt(outstanding)} outstanding</span
		>
	{/snippet}
	{#snippet actions()}
		<button
			onclick={() => (expCreateOpen = true)}
			class="press flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
		>
			<Receipt size={15} />
			<span class="hidden sm:inline">Add expense</span>
			<span class="sm:hidden">Expense</span>
		</button>
		<button
			onclick={() => (payCreateOpen = true)}
			class="press flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
		>
			<Plus size={15} />
			<span class="hidden sm:inline">Record payment</span>
			<span class="sm:hidden">Payment</span>
		</button>
	{/snippet}
</PageTitleBar>

<!-- Section switcher -->
<div class="flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1 sm:w-fit">
	{#each tabs as tab (tab.id)}
		{@const TabIcon = tab.icon}
		<button
			onclick={() => (activeTab = tab.id)}
			class="press flex shrink-0 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors {activeTab ===
			tab.id
				? 'bg-secondary text-foreground'
				: 'text-muted-foreground hover:text-foreground'}"
		>
			<TabIcon size={15} />
			{tab.label}
			{#if tab.count !== undefined}
				<span class="tabular-nums text-xs text-muted-foreground">{tab.count}</span>
			{/if}
		</button>
	{/each}
</div>

{#if activeTab === 'overview'}
	<!-- Grouped money summary -->
	<div class="rise mt-4 rounded-xl border border-border bg-card p-4 sm:p-5">
		<div class="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
			{#each summary as stat (stat.label)}
				<div class="min-w-0">
					<p class="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
						{stat.label}
					</p>
					<p class="mt-1 truncate text-xl font-bold tabular-nums {stat.tone} sm:text-2xl">
						{stat.value}
					</p>
				</div>
			{/each}
		</div>

		<div class="mt-5 border-t border-border/60 pt-4">
			<div class="flex items-center justify-between text-xs">
				<span class="font-medium uppercase tracking-wide text-muted-foreground">Budget paid</span>
				<span class="font-semibold tabular-nums text-foreground">{Math.round(paidPct)}%</span>
			</div>
			<div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
				<div class="h-full rounded-full bg-success" style:width={`${paidPct}%`}></div>
			</div>
		</div>
	</div>

	<!-- Outstanding milestones -->
	{#if unpaidMilestones > 0}
		<div class="rise mt-4 rounded-xl border border-border bg-card" style:--delay="40ms">
			<div class="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/60 px-4 py-3 sm:px-5">
				<h2 class="text-sm font-semibold text-foreground">Outstanding balance</h2>
				<p class="text-xs text-muted-foreground">
					{unpaidMilestones} unpaid milestone{unpaidMilestones === 1 ? '' : 's'} totalling
					<strong class="font-semibold tabular-nums text-foreground">{fmt(outstanding)}</strong>
				</p>
			</div>
			<div class="divide-y divide-border/60">
				{#each openMilestones as ms (ms.id)}
					<div class="row-hover flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium text-foreground">{ms.title}</p>
							{#if ms.due_date}
								<p class="text-xs tabular-nums text-muted-foreground">Due {fmtDate(ms.due_date)}</p>
							{/if}
						</div>
						<div class="flex shrink-0 items-center gap-3">
							<StatusBadge status={ms.status} size="sm" />
							<span class="text-sm font-semibold tabular-nums text-foreground"
								>{fmt(Number(ms.amount))}</span
							>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Recent payments -->
	{#if data.payments.length > 0}
		<div class="rise mt-4 rounded-xl border border-border bg-card" style:--delay="80ms">
			<div class="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3 sm:px-5">
				<h2 class="text-sm font-semibold text-foreground">Recent payments</h2>
				<button
					onclick={() => (activeTab = 'payments')}
					class="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
					>View all</button
				>
			</div>
			<div class="divide-y divide-border/60">
				{#each data.payments.slice(0, 5) as pay (pay.id)}
					<div class="row-hover flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium text-foreground">
								{milestoneName(pay.milestone_id) || 'General payment'}
							</p>
							<p class="text-xs text-muted-foreground">
								<span class="tabular-nums">{fmtDate(pay.paid_at)}</span>
								{#if pay.payment_method}
									&middot;
									<span class="capitalize">{pay.payment_method.replace(/_/g, ' ')}</span>
								{/if}
							</p>
						</div>
						<span class="shrink-0 text-sm font-semibold tabular-nums text-success"
							>+{fmt(Number(pay.amount))}</span
						>
					</div>
				{/each}
			</div>
		</div>
	{/if}
{:else if activeTab === 'payments'}
	{#if data.payments.length === 0}
		<div class="mt-4 rounded-xl border border-border bg-card">
			<EmptyState
				icon={CreditCard}
				title="No payments recorded"
				description="Record a payment to track project transactions."
			/>
		</div>
	{:else}
		<!-- Mobile cards -->
		<div class="mt-4 space-y-3 sm:hidden">
			{#each data.payments as pay, i (pay.id)}
				<div
					class="rise card-hover rounded-xl border border-border bg-card p-4"
					style:--delay={delay(i)}
				>
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0 flex-1">
							<p class="text-lg font-bold tabular-nums text-success">{fmt(Number(pay.amount))}</p>
							<p class="mt-0.5 truncate text-sm text-muted-foreground">
								{milestoneName(pay.milestone_id) || 'General'}
							</p>
						</div>
						{#if pay.payment_method}
							<StatusBadge status={pay.payment_method} size="sm" />
						{/if}
					</div>
					<div class="mt-2 text-xs tabular-nums text-muted-foreground">{fmtDate(pay.paid_at)}</div>
					{#if pay.notes}
						<p class="mt-1 line-clamp-2 text-xs text-muted-foreground">{pay.notes}</p>
					{/if}
					<div class="mt-3 flex gap-2">
						<button
							onclick={() => {
								payEditing = pay;
								payEditOpen = true;
							}}
							class="press rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
						>
							Edit
						</button>
						<button
							onclick={() => {
								payDeletingId = pay.id;
								payDeleteOpen = true;
							}}
							class="press rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20"
						>
							Delete
						</button>
					</div>
				</div>
			{/each}
		</div>

		<!-- Desktop table -->
		<div class="mt-4 hidden overflow-x-auto rounded-xl border border-border sm:block">
			<table class="w-full min-w-[42rem] text-left">
				<thead class="border-b border-border bg-secondary/40">
					<tr>
						<th class="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
							>Amount</th
						>
						<th class="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
							>Method</th
						>
						<th class="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
							>Milestone</th
						>
						<th class="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
							>Date</th
						>
						<th
							class="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:table-cell"
							>Notes</th
						>
						<th class="px-4 py-2.5"></th>
					</tr>
				</thead>
				<tbody>
					{#each data.payments as pay, i (pay.id)}
						<tr class="rise row-hover border-b border-border/60 last:border-b-0" style:--delay={delay(i)}>
							<td class="px-4 py-2.5 text-sm font-semibold tabular-nums text-success"
								>{fmt(Number(pay.amount))}</td
							>
							<td class="px-4 py-2.5">
								{#if pay.payment_method}
									<StatusBadge status={pay.payment_method} size="sm" />
								{:else}
									<span class="text-sm text-muted-foreground">--</span>
								{/if}
							</td>
							<td class="max-w-[16rem] truncate px-4 py-2.5 text-sm text-foreground"
								>{milestoneName(pay.milestone_id) || '--'}</td
							>
							<td class="whitespace-nowrap px-4 py-2.5 text-sm tabular-nums text-muted-foreground"
								>{fmtDate(pay.paid_at)}</td
							>
							<td
								class="hidden max-w-[12rem] truncate px-4 py-2.5 text-sm text-muted-foreground lg:table-cell"
								>{pay.notes || '--'}</td
							>
							<td class="px-4 py-2.5">
								<div class="flex items-center justify-end gap-1">
									<button
										onclick={() => {
											payEditing = pay;
											payEditOpen = true;
										}}
										class="press rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
										aria-label="Edit payment"
									>
										<Pencil size={14} />
									</button>
									<button
										onclick={() => {
											payDeletingId = pay.id;
											payDeleteOpen = true;
										}}
										class="press rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
										aria-label="Delete payment"
									>
										<Trash2 size={14} />
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
{:else if activeTab === 'expenses'}
	{#if data.expenses.length === 0}
		<div class="mt-4 rounded-xl border border-border bg-card">
			<EmptyState
				icon={Receipt}
				title="No expenses tracked"
				description="Add expenses to track internal costs like hosting and APIs."
			/>
		</div>
	{:else}
		<!-- Mobile cards -->
		<div class="mt-4 space-y-3 sm:hidden">
			{#each data.expenses as exp, i (exp.id)}
				<div
					class="rise card-hover rounded-xl border border-border bg-card p-4"
					style:--delay={delay(i)}
				>
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-semibold text-foreground">{exp.title}</p>
							<p class="mt-0.5 text-lg font-bold tabular-nums text-destructive">
								{fmt(Number(exp.amount))}
							</p>
						</div>
						{#if exp.category}
							<StatusBadge status={exp.category} size="sm" />
						{/if}
					</div>
					<div class="mt-2 text-xs tabular-nums text-muted-foreground">{fmtDate(exp.spent_at)}</div>
					{#if exp.notes}
						<p class="mt-1 line-clamp-2 text-xs text-muted-foreground">{exp.notes}</p>
					{/if}
					<div class="mt-3 flex gap-2">
						<button
							onclick={() => {
								expEditing = exp;
								expEditOpen = true;
							}}
							class="press rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
						>
							Edit
						</button>
						<button
							onclick={() => {
								expDeletingId = exp.id;
								expDeleteOpen = true;
							}}
							class="press rounded-lg bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20"
						>
							Delete
						</button>
					</div>
				</div>
			{/each}
		</div>

		<!-- Desktop table -->
		<div class="mt-4 hidden overflow-x-auto rounded-xl border border-border sm:block">
			<table class="w-full min-w-[42rem] text-left">
				<thead class="border-b border-border bg-secondary/40">
					<tr>
						<th class="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
							>Expense</th
						>
						<th class="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
							>Amount</th
						>
						<th class="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
							>Category</th
						>
						<th class="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
							>Date</th
						>
						<th
							class="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:table-cell"
							>Notes</th
						>
						<th class="px-4 py-2.5"></th>
					</tr>
				</thead>
				<tbody>
					{#each data.expenses as exp, i (exp.id)}
						<tr class="rise row-hover border-b border-border/60 last:border-b-0" style:--delay={delay(i)}>
							<td class="max-w-[16rem] truncate px-4 py-2.5 text-sm font-medium text-foreground"
								>{exp.title}</td
							>
							<td class="px-4 py-2.5 text-sm font-semibold tabular-nums text-destructive"
								>{fmt(Number(exp.amount))}</td
							>
							<td class="px-4 py-2.5">
								{#if exp.category}
									<StatusBadge status={exp.category} size="sm" />
								{:else}
									<span class="text-sm text-muted-foreground">--</span>
								{/if}
							</td>
							<td class="whitespace-nowrap px-4 py-2.5 text-sm tabular-nums text-muted-foreground"
								>{fmtDate(exp.spent_at)}</td
							>
							<td
								class="hidden max-w-[12rem] truncate px-4 py-2.5 text-sm text-muted-foreground lg:table-cell"
								>{exp.notes || '--'}</td
							>
							<td class="px-4 py-2.5">
								<div class="flex items-center justify-end gap-1">
									<button
										onclick={() => {
											expEditing = exp;
											expEditOpen = true;
										}}
										class="press rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
										aria-label="Edit expense"
									>
										<Pencil size={14} />
									</button>
									<button
										onclick={() => {
											expDeletingId = exp.id;
											expDeleteOpen = true;
										}}
										class="press rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
										aria-label="Delete expense"
									>
										<Trash2 size={14} />
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
{/if}

<!-- ── Create Payment ────────────────────────────── -->
<Modal bind:open={payCreateOpen} title="Record Payment">
	<form
		method="POST"
		action="?/createPayment"
		use:enhance={() => {
			return async ({ update }) => {
				await update();
				payCreateOpen = false;
			};
		}}
		class="space-y-4"
	>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<div>
				<label for="pay-c-amount" class={labelClass}>Amount ($) *</label>
				<input
					id="pay-c-amount"
					name="amount"
					type="number"
					step="0.01"
					min="0.01"
					required
					class="{fieldClass} tabular-nums"
				/>
			</div>
			<div>
				<label for="pay-c-method" class={labelClass}>Method</label>
				<select id="pay-c-method" name="payment_method" class={fieldClass}>
					<option value="">None</option>
					{#each PAYMENT_METHODS as m (m)}
						<option value={m}>{m.replace(/_/g, ' ')}</option>
					{/each}
				</select>
			</div>
		</div>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<div>
				<label for="pay-c-milestone" class={labelClass}>Milestone</label>
				<select id="pay-c-milestone" name="milestone_id" class={fieldClass}>
					<option value="">None</option>
					{#each data.milestones as ms (ms.id)}
						<option value={ms.id}>{ms.title} ({fmt(Number(ms.amount))})</option>
					{/each}
				</select>
			</div>
			<div>
				<label for="pay-c-date" class={labelClass}>Date</label>
				<input
					id="pay-c-date"
					name="paid_at"
					type="date"
					value={new Date().toISOString().slice(0, 10)}
					class="{fieldClass} tabular-nums"
				/>
			</div>
		</div>
		<div>
			<label for="pay-c-notes" class={labelClass}>Notes</label>
			<textarea id="pay-c-notes" name="notes" rows="2" class={fieldClass}></textarea>
		</div>
		<div class="flex justify-end gap-3 pt-2">
			<button
				type="button"
				onclick={() => (payCreateOpen = false)}
				class="press rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
				>Cancel</button
			>
			<button
				type="submit"
				class="press rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
				>Record Payment</button
			>
		</div>
	</form>
</Modal>

<!-- ── Edit Payment ──────────────────────────────── -->
<Modal bind:open={payEditOpen} title="Edit Payment">
	{#if payEditing}
		<form
			method="POST"
			action="?/updatePayment"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
					payEditOpen = false;
				};
			}}
			class="space-y-4"
		>
			<input type="hidden" name="id" value={payEditing.id} />
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div>
					<label for="pay-e-amount" class={labelClass}>Amount ($) *</label>
					<input
						id="pay-e-amount"
						name="amount"
						type="number"
						step="0.01"
						min="0.01"
						required
						value={payEditing.amount}
						class="{fieldClass} tabular-nums"
					/>
				</div>
				<div>
					<label for="pay-e-method" class={labelClass}>Method</label>
					<select id="pay-e-method" name="payment_method" class={fieldClass}>
						<option value="">None</option>
						{#each PAYMENT_METHODS as m (m)}
							<option value={m} selected={payEditing.payment_method === m}
								>{m.replace(/_/g, ' ')}</option
							>
						{/each}
					</select>
				</div>
			</div>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div>
					<label for="pay-e-milestone" class={labelClass}>Milestone</label>
					<select id="pay-e-milestone" name="milestone_id" class={fieldClass}>
						<option value="">None</option>
						{#each data.milestones as ms (ms.id)}
							<option value={ms.id} selected={payEditing.milestone_id === ms.id}
								>{ms.title} ({fmt(Number(ms.amount))})</option
							>
						{/each}
					</select>
				</div>
				<div>
					<label for="pay-e-date" class={labelClass}>Date</label>
					<input
						id="pay-e-date"
						name="paid_at"
						type="date"
						value={payEditing.paid_at}
						class="{fieldClass} tabular-nums"
					/>
				</div>
			</div>
			<div>
				<label for="pay-e-notes" class={labelClass}>Notes</label>
				<textarea id="pay-e-notes" name="notes" rows="2" class={fieldClass}
					>{payEditing.notes}</textarea
				>
			</div>
			<div class="flex justify-end gap-3 pt-2">
				<button
					type="button"
					onclick={() => (payEditOpen = false)}
					class="press rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
					>Cancel</button
				>
				<button
					type="submit"
					class="press rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
					>Save Changes</button
				>
			</div>
		</form>
	{/if}
</Modal>

<!-- ── Delete Payment ────────────────────────────── -->
<Modal bind:open={payDeleteOpen} title="Delete Payment">
	<form
		method="POST"
		action="?/deletePayment"
		use:enhance={() => {
			return async ({ update }) => {
				await update();
				payDeleteOpen = false;
			};
		}}
	>
		<input type="hidden" name="id" value={payDeletingId} />
		<div class="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
			<AlertTriangle size={20} class="mt-0.5 shrink-0 text-destructive" />
			<p class="text-sm text-muted-foreground">
				This will permanently delete this payment record. This action cannot be undone.
			</p>
		</div>
		<div class="mt-6 flex justify-end gap-3">
			<button
				type="button"
				onclick={() => (payDeleteOpen = false)}
				class="press rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
				>Cancel</button
			>
			<button
				type="submit"
				class="press rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90"
				>Delete</button
			>
		</div>
	</form>
</Modal>

<!-- ── Create Expense ────────────────────────────── -->
<Modal bind:open={expCreateOpen} title="Add Expense">
	<form
		method="POST"
		action="?/createExpense"
		use:enhance={() => {
			return async ({ update }) => {
				await update();
				expCreateOpen = false;
			};
		}}
		class="space-y-4"
	>
		<div>
			<label for="exp-c-title" class={labelClass}>Title *</label>
			<input id="exp-c-title" name="title" required class={fieldClass} />
		</div>
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<div>
				<label for="exp-c-amount" class={labelClass}>Amount ($)</label>
				<input
					id="exp-c-amount"
					name="amount"
					type="number"
					step="0.01"
					min="0"
					value="0"
					class="{fieldClass} tabular-nums"
				/>
			</div>
			<div>
				<label for="exp-c-cat" class={labelClass}>Category</label>
				<select id="exp-c-cat" name="category" class={fieldClass}>
					<option value="">None</option>
					{#each EXPENSE_CATEGORIES as c (c)}
						<option value={c}>{c.replace(/_/g, ' ')}</option>
					{/each}
				</select>
			</div>
		</div>
		<div>
			<label for="exp-c-date" class={labelClass}>Date</label>
			<input
				id="exp-c-date"
				name="spent_at"
				type="date"
				value={new Date().toISOString().slice(0, 10)}
				class="{fieldClass} tabular-nums"
			/>
		</div>
		<div>
			<label for="exp-c-notes" class={labelClass}>Notes</label>
			<textarea id="exp-c-notes" name="notes" rows="2" class={fieldClass}></textarea>
		</div>
		<div class="flex justify-end gap-3 pt-2">
			<button
				type="button"
				onclick={() => (expCreateOpen = false)}
				class="press rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
				>Cancel</button
			>
			<button
				type="submit"
				class="press rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
				>Add Expense</button
			>
		</div>
	</form>
</Modal>

<!-- ── Edit Expense ──────────────────────────────── -->
<Modal bind:open={expEditOpen} title="Edit Expense">
	{#if expEditing}
		<form
			method="POST"
			action="?/updateExpense"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
					expEditOpen = false;
				};
			}}
			class="space-y-4"
		>
			<input type="hidden" name="id" value={expEditing.id} />
			<div>
				<label for="exp-e-title" class={labelClass}>Title *</label>
				<input id="exp-e-title" name="title" required value={expEditing.title} class={fieldClass} />
			</div>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div>
					<label for="exp-e-amount" class={labelClass}>Amount ($)</label>
					<input
						id="exp-e-amount"
						name="amount"
						type="number"
						step="0.01"
						min="0"
						value={expEditing.amount}
						class="{fieldClass} tabular-nums"
					/>
				</div>
				<div>
					<label for="exp-e-cat" class={labelClass}>Category</label>
					<select id="exp-e-cat" name="category" class={fieldClass}>
						<option value="">None</option>
						{#each EXPENSE_CATEGORIES as c (c)}
							<option value={c} selected={expEditing.category === c}>{c.replace(/_/g, ' ')}</option>
						{/each}
					</select>
				</div>
			</div>
			<div>
				<label for="exp-e-date" class={labelClass}>Date</label>
				<input
					id="exp-e-date"
					name="spent_at"
					type="date"
					value={expEditing.spent_at}
					class="{fieldClass} tabular-nums"
				/>
			</div>
			<div>
				<label for="exp-e-notes" class={labelClass}>Notes</label>
				<textarea id="exp-e-notes" name="notes" rows="2" class={fieldClass}
					>{expEditing.notes}</textarea
				>
			</div>
			<div class="flex justify-end gap-3 pt-2">
				<button
					type="button"
					onclick={() => (expEditOpen = false)}
					class="press rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
					>Cancel</button
				>
				<button
					type="submit"
					class="press rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
					>Save Changes</button
				>
			</div>
		</form>
	{/if}
</Modal>

<!-- ── Delete Expense ────────────────────────────── -->
<Modal bind:open={expDeleteOpen} title="Delete Expense">
	<form
		method="POST"
		action="?/deleteExpense"
		use:enhance={() => {
			return async ({ update }) => {
				await update();
				expDeleteOpen = false;
			};
		}}
	>
		<input type="hidden" name="id" value={expDeletingId} />
		<div class="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
			<AlertTriangle size={20} class="mt-0.5 shrink-0 text-destructive" />
			<p class="text-sm text-muted-foreground">
				This will permanently delete this expense record. This action cannot be undone.
			</p>
		</div>
		<div class="mt-6 flex justify-end gap-3">
			<button
				type="button"
				onclick={() => (expDeleteOpen = false)}
				class="press rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
				>Cancel</button
			>
			<button
				type="submit"
				class="press rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90"
				>Delete</button
			>
		</div>
	</form>
</Modal>

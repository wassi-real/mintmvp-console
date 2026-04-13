<script lang="ts">
	import { enhance } from '$app/forms';
	import Modal from '$lib/components/Modal.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import StatCard from '$lib/components/StatCard.svelte';
	import {
		DollarSign,
		Plus,
		Pencil,
		Trash2,
		Landmark,
		CreditCard,
		Receipt,
		CircleDollarSign,
		Clock,
		CheckCircle2,
		AlertTriangle
	} from 'lucide-svelte';
	import type { Tables } from '$lib/supabase/types';

	let { data } = $props();

	type Tab = 'overview' | 'milestones' | 'payments' | 'expenses';
	let activeTab: Tab = $state('overview');

	/* ── Derived finance stats ────────────────────────── */
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

	/* ── Helpers ──────────────────────────────────────── */
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

	/* ── Milestone CRUD state ────────────────────────── */
	let msCreateOpen = $state(false);
	let msEditOpen = $state(false);
	let msDeleteOpen = $state(false);
	let msEditing: Tables<'milestones'> | null = $state(null);
	let msDeletingId = $state('');

	/* ── Payment CRUD state ──────────────────────────── */
	let payCreateOpen = $state(false);
	let payEditOpen = $state(false);
	let payDeleteOpen = $state(false);
	let payEditing: Tables<'payments'> | null = $state(null);
	let payDeletingId = $state('');

	/* ── Expense CRUD state ──────────────────────────── */
	let expCreateOpen = $state(false);
	let expEditOpen = $state(false);
	let expDeleteOpen = $state(false);
	let expEditing: Tables<'expenses'> | null = $state(null);
	let expDeletingId = $state('');

	const MILESTONE_STATUSES = ['planned', 'active', 'ready_for_payment', 'paid', 'overdue'] as const;
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
</script>

<!-- ═══════════ TAB BAR ═══════════ -->
<div class="mt-4 flex gap-1 overflow-x-auto border-b border-border">
	{#each [
		{ id: 'overview', label: 'Overview', icon: CircleDollarSign },
		{ id: 'milestones', label: 'Milestones', icon: Landmark, count: data.milestones.length },
		{ id: 'payments', label: 'Payments', icon: CreditCard, count: data.payments.length },
		{ id: 'expenses', label: 'Expenses', icon: Receipt, count: data.expenses.length }
	] as tab}
		{@const TabIcon = tab.icon}
		<button
			onclick={() => (activeTab = tab.id as Tab)}
			class="flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors {activeTab ===
			tab.id
				? 'border-primary text-foreground'
				: 'border-transparent text-muted-foreground hover:text-foreground'}"
		>
			<TabIcon size={16} />
			{tab.label}
			{#if tab.count !== undefined}
				<span
					class="ml-1 rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground"
					>{tab.count}</span
				>
			{/if}
		</button>
	{/each}
</div>

<!-- ═══════════ OVERVIEW TAB ═══════════ -->
{#if activeTab === 'overview'}
	<div class="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
		<StatCard label="Total Budget" value={fmt(totalBudget)} icon={DollarSign} />
		<StatCard label="Total Paid" value={fmt(totalPaid)} icon={CheckCircle2} variant="success" />
		<StatCard
			label="Pending Payment"
			value={fmt(pendingPayment)}
			icon={Clock}
			variant={pendingPayment > 0 ? 'warning' : 'default'}
		/>
		<StatCard
			label="Next Milestone"
			value={nextMilestoneAmount > 0 ? fmt(nextMilestoneAmount) : '--'}
			icon={Landmark}
		/>
	</div>

	<!-- Outstanding balance -->
	<div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
		<div class="rounded-xl border border-border bg-card p-5">
			<p class="text-xs font-medium text-muted-foreground sm:text-sm">Paid Milestones</p>
			<p class="mt-1 text-2xl font-bold text-green-400 sm:text-3xl">{paidMilestones}</p>
		</div>
		<div class="rounded-xl border border-border bg-card p-5">
			<p class="text-xs font-medium text-muted-foreground sm:text-sm">Unpaid Milestones</p>
			<p class="mt-1 text-2xl font-bold text-amber-400 sm:text-3xl">{unpaidMilestones}</p>
		</div>
		<div class="rounded-xl border border-border bg-card p-5">
			<p class="text-xs font-medium text-muted-foreground sm:text-sm">Total Expenses</p>
			<p class="mt-1 text-2xl font-bold text-red-400 sm:text-3xl">{fmt(totalExpenses)}</p>
		</div>
	</div>

	<!-- Outstanding milestones quick list -->
	{#if unpaidMilestones > 0}
		<div class="mt-6 rounded-xl border border-border bg-card">
			<div class="border-b border-border px-5 py-4">
				<h3 class="text-base font-semibold text-foreground">Outstanding Balance</h3>
				<p class="mt-0.5 text-sm text-muted-foreground">
					{unpaidMilestones} unpaid milestone{unpaidMilestones === 1 ? '' : 's'} totalling
					<strong class="text-foreground">{fmt(totalBudget - totalPaid)}</strong>
				</p>
			</div>
			<div class="divide-y divide-border">
				{#each data.milestones.filter((m) => m.status !== 'paid') as ms}
					<div class="flex items-center justify-between px-5 py-3">
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium text-foreground">{ms.title}</p>
							{#if ms.due_date}
								<p class="text-xs text-muted-foreground">Due {fmtDate(ms.due_date)}</p>
							{/if}
						</div>
						<div class="ml-4 flex items-center gap-3">
							<StatusBadge status={ms.status} size="sm" />
							<span class="text-sm font-semibold text-foreground">{fmt(Number(ms.amount))}</span>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Recent payments quick list -->
	{#if data.payments.length > 0}
		<div class="mt-6 rounded-xl border border-border bg-card">
			<div class="border-b border-border px-5 py-4">
				<h3 class="text-base font-semibold text-foreground">Recent Payments</h3>
			</div>
			<div class="divide-y divide-border">
				{#each data.payments.slice(0, 5) as pay}
					<div class="flex items-center justify-between px-5 py-3">
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium text-foreground">
								{milestoneName(pay.milestone_id) || 'General payment'}
							</p>
							<p class="text-xs text-muted-foreground">
								{fmtDate(pay.paid_at)}
								{#if pay.payment_method}
									&middot;
									<span class="capitalize">{pay.payment_method.replace(/_/g, ' ')}</span>
								{/if}
							</p>
						</div>
						<span class="ml-4 text-sm font-semibold text-green-400"
							>+{fmt(Number(pay.amount))}</span
						>
					</div>
				{/each}
			</div>
		</div>
	{/if}

<!-- ═══════════ MILESTONES TAB ═══════════ -->
{:else if activeTab === 'milestones'}
	<div class="mt-4 flex items-center justify-end">
		<button
			onclick={() => (msCreateOpen = true)}
			class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
		>
			<Plus size={16} />
			Add Milestone
		</button>
	</div>

	{#if data.milestones.length === 0}
		<div class="mt-12 text-center">
			<Landmark size={48} class="mx-auto text-muted-foreground/40" />
			<p class="mt-4 text-lg font-semibold text-foreground">No milestones yet</p>
			<p class="mt-1 text-sm text-muted-foreground">Create a milestone to start tracking project budget</p>
		</div>
	{:else}
		<!-- Mobile cards -->
		<div class="mt-6 space-y-3 sm:hidden">
			{#each data.milestones as ms}
				<div class="rounded-xl border border-border bg-card p-4">
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0 flex-1">
							<p class="text-base font-semibold text-foreground">{ms.title}</p>
							<p class="mt-1 text-lg font-bold text-foreground">{fmt(Number(ms.amount))}</p>
						</div>
						<StatusBadge status={ms.status} size="sm" />
					</div>
					{#if ms.description}
						<p class="mt-2 text-sm text-muted-foreground line-clamp-2">{ms.description}</p>
					{/if}
					<div class="mt-3 flex items-center justify-between text-xs text-muted-foreground">
						<span>Due: {fmtDate(ms.due_date)}</span>
						<span>Paid: {fmtDate(ms.paid_date)}</span>
					</div>
					<div class="mt-3 flex gap-2">
						<button
							onclick={() => {
								msEditing = ms;
								msEditOpen = true;
							}}
							class="rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/80"
						>
							Edit
						</button>
						<button
							onclick={() => {
								msDeletingId = ms.id;
								msDeleteOpen = true;
							}}
							class="rounded-lg bg-red-900/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-900/50"
						>
							Delete
						</button>
					</div>
				</div>
			{/each}
		</div>

		<!-- Desktop table -->
		<div class="mt-6 hidden overflow-x-auto rounded-xl border border-border sm:block">
			<table class="w-full text-left">
				<thead class="border-b border-border bg-secondary/50">
					<tr>
						<th class="px-4 py-3 text-xs font-semibold text-muted-foreground">Milestone</th>
						<th class="px-4 py-3 text-xs font-semibold text-muted-foreground">Amount</th>
						<th class="px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
						<th
							class="hidden px-4 py-3 text-xs font-semibold text-muted-foreground md:table-cell"
						>
							Due Date
						</th>
						<th
							class="hidden px-4 py-3 text-xs font-semibold text-muted-foreground lg:table-cell"
						>
							Paid Date
						</th>
						<th class="px-4 py-3 text-xs font-semibold text-muted-foreground"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					{#each data.milestones as ms}
						<tr class="transition-colors hover:bg-secondary/20">
							<td class="px-4 py-3">
								<p class="text-sm font-medium text-foreground">{ms.title}</p>
								{#if ms.description}
									<p class="mt-0.5 text-xs text-muted-foreground line-clamp-1">
										{ms.description}
									</p>
								{/if}
							</td>
							<td class="px-4 py-3 text-sm font-semibold text-foreground"
								>{fmt(Number(ms.amount))}</td
							>
							<td class="px-4 py-3"><StatusBadge status={ms.status} size="sm" /></td>
							<td
								class="hidden px-4 py-3 text-sm text-muted-foreground md:table-cell"
								>{fmtDate(ms.due_date)}</td
							>
							<td
								class="hidden px-4 py-3 text-sm text-muted-foreground lg:table-cell"
								>{fmtDate(ms.paid_date)}</td
							>
							<td class="px-4 py-3">
								<div class="flex items-center gap-1">
									<button
										onclick={() => {
											msEditing = ms;
											msEditOpen = true;
										}}
										class="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
										aria-label="Edit"
									>
										<Pencil size={14} />
									</button>
									<button
										onclick={() => {
											msDeletingId = ms.id;
											msDeleteOpen = true;
										}}
										class="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-900/30 hover:text-red-400"
										aria-label="Delete"
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

<!-- ═══════════ PAYMENTS TAB ═══════════ -->
{:else if activeTab === 'payments'}
	<div class="mt-4 flex items-center justify-end">
		<button
			onclick={() => (payCreateOpen = true)}
			class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
		>
			<Plus size={16} />
			Record Payment
		</button>
	</div>

	{#if data.payments.length === 0}
		<div class="mt-12 text-center">
			<CreditCard size={48} class="mx-auto text-muted-foreground/40" />
			<p class="mt-4 text-lg font-semibold text-foreground">No payments recorded</p>
			<p class="mt-1 text-sm text-muted-foreground">Record a payment to track project transactions</p>
		</div>
	{:else}
		<!-- Mobile cards -->
		<div class="mt-6 space-y-3 sm:hidden">
			{#each data.payments as pay}
				<div class="rounded-xl border border-border bg-card p-4">
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0 flex-1">
							<p class="text-lg font-bold text-green-400">{fmt(Number(pay.amount))}</p>
							<p class="mt-0.5 text-sm text-muted-foreground">
								{milestoneName(pay.milestone_id) || 'General'}
							</p>
						</div>
						{#if pay.payment_method}
							<StatusBadge status={pay.payment_method} size="sm" />
						{/if}
					</div>
					<div class="mt-2 text-xs text-muted-foreground">{fmtDate(pay.paid_at)}</div>
					{#if pay.notes}
						<p class="mt-1 text-xs text-muted-foreground line-clamp-2">{pay.notes}</p>
					{/if}
					<div class="mt-3 flex gap-2">
						<button
							onclick={() => {
								payEditing = pay;
								payEditOpen = true;
							}}
							class="rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/80"
						>
							Edit
						</button>
						<button
							onclick={() => {
								payDeletingId = pay.id;
								payDeleteOpen = true;
							}}
							class="rounded-lg bg-red-900/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-900/50"
						>
							Delete
						</button>
					</div>
				</div>
			{/each}
		</div>

		<!-- Desktop table -->
		<div class="mt-6 hidden overflow-x-auto rounded-xl border border-border sm:block">
			<table class="w-full text-left">
				<thead class="border-b border-border bg-secondary/50">
					<tr>
						<th class="px-4 py-3 text-xs font-semibold text-muted-foreground">Amount</th>
						<th class="px-4 py-3 text-xs font-semibold text-muted-foreground">Method</th>
						<th class="px-4 py-3 text-xs font-semibold text-muted-foreground">Milestone</th>
						<th class="px-4 py-3 text-xs font-semibold text-muted-foreground">Date</th>
						<th
							class="hidden px-4 py-3 text-xs font-semibold text-muted-foreground lg:table-cell"
						>
							Notes
						</th>
						<th class="px-4 py-3 text-xs font-semibold text-muted-foreground"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					{#each data.payments as pay}
						<tr class="transition-colors hover:bg-secondary/20">
							<td class="px-4 py-3 text-sm font-semibold text-green-400"
								>{fmt(Number(pay.amount))}</td
							>
							<td class="px-4 py-3">
								{#if pay.payment_method}
									<StatusBadge status={pay.payment_method} size="sm" />
								{:else}
									<span class="text-sm text-muted-foreground">--</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-sm text-foreground"
								>{milestoneName(pay.milestone_id) || '--'}</td
							>
							<td class="px-4 py-3 text-sm text-muted-foreground">{fmtDate(pay.paid_at)}</td>
							<td
								class="hidden max-w-[200px] truncate px-4 py-3 text-sm text-muted-foreground lg:table-cell"
								>{pay.notes || '--'}</td
							>
							<td class="px-4 py-3">
								<div class="flex items-center gap-1">
									<button
										onclick={() => {
											payEditing = pay;
											payEditOpen = true;
										}}
										class="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
										aria-label="Edit"
									>
										<Pencil size={14} />
									</button>
									<button
										onclick={() => {
											payDeletingId = pay.id;
											payDeleteOpen = true;
										}}
										class="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-900/30 hover:text-red-400"
										aria-label="Delete"
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

<!-- ═══════════ EXPENSES TAB ═══════════ -->
{:else if activeTab === 'expenses'}
	<div class="mt-4 flex items-center justify-end">
		<button
			onclick={() => (expCreateOpen = true)}
			class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
		>
			<Plus size={16} />
			Add Expense
		</button>
	</div>

	{#if data.expenses.length === 0}
		<div class="mt-12 text-center">
			<Receipt size={48} class="mx-auto text-muted-foreground/40" />
			<p class="mt-4 text-lg font-semibold text-foreground">No expenses tracked</p>
			<p class="mt-1 text-sm text-muted-foreground">
				Add expenses to track internal costs like hosting and APIs
			</p>
		</div>
	{:else}
		<!-- Mobile cards -->
		<div class="mt-6 space-y-3 sm:hidden">
			{#each data.expenses as exp}
				<div class="rounded-xl border border-border bg-card p-4">
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0 flex-1">
							<p class="text-base font-semibold text-foreground">{exp.title}</p>
							<p class="mt-0.5 text-lg font-bold text-red-400">{fmt(Number(exp.amount))}</p>
						</div>
						{#if exp.category}
							<StatusBadge status={exp.category} size="sm" />
						{/if}
					</div>
					<div class="mt-2 text-xs text-muted-foreground">{fmtDate(exp.spent_at)}</div>
					{#if exp.notes}
						<p class="mt-1 text-xs text-muted-foreground line-clamp-2">{exp.notes}</p>
					{/if}
					<div class="mt-3 flex gap-2">
						<button
							onclick={() => {
								expEditing = exp;
								expEditOpen = true;
							}}
							class="rounded-lg bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/80"
						>
							Edit
						</button>
						<button
							onclick={() => {
								expDeletingId = exp.id;
								expDeleteOpen = true;
							}}
							class="rounded-lg bg-red-900/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-900/50"
						>
							Delete
						</button>
					</div>
				</div>
			{/each}
		</div>

		<!-- Desktop table -->
		<div class="mt-6 hidden overflow-x-auto rounded-xl border border-border sm:block">
			<table class="w-full text-left">
				<thead class="border-b border-border bg-secondary/50">
					<tr>
						<th class="px-4 py-3 text-xs font-semibold text-muted-foreground">Expense</th>
						<th class="px-4 py-3 text-xs font-semibold text-muted-foreground">Amount</th>
						<th class="px-4 py-3 text-xs font-semibold text-muted-foreground">Category</th>
						<th class="px-4 py-3 text-xs font-semibold text-muted-foreground">Date</th>
						<th
							class="hidden px-4 py-3 text-xs font-semibold text-muted-foreground lg:table-cell"
						>
							Notes
						</th>
						<th class="px-4 py-3 text-xs font-semibold text-muted-foreground"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border">
					{#each data.expenses as exp}
						<tr class="transition-colors hover:bg-secondary/20">
							<td class="px-4 py-3 text-sm font-medium text-foreground">{exp.title}</td>
							<td class="px-4 py-3 text-sm font-semibold text-red-400"
								>{fmt(Number(exp.amount))}</td
							>
							<td class="px-4 py-3">
								{#if exp.category}
									<StatusBadge status={exp.category} size="sm" />
								{:else}
									<span class="text-sm text-muted-foreground">--</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-sm text-muted-foreground">{fmtDate(exp.spent_at)}</td>
							<td
								class="hidden max-w-[200px] truncate px-4 py-3 text-sm text-muted-foreground lg:table-cell"
								>{exp.notes || '--'}</td
							>
							<td class="px-4 py-3">
								<div class="flex items-center gap-1">
									<button
										onclick={() => {
											expEditing = exp;
											expEditOpen = true;
										}}
										class="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
										aria-label="Edit"
									>
										<Pencil size={14} />
									</button>
									<button
										onclick={() => {
											expDeletingId = exp.id;
											expDeleteOpen = true;
										}}
										class="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-red-900/30 hover:text-red-400"
										aria-label="Delete"
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

<!-- ═══════════════════════════════════════════════════════
     MODALS
     ═══════════════════════════════════════════════════════ -->

<!-- ── Create Milestone ──────────────────────────── -->
<Modal bind:open={msCreateOpen} title="New Milestone">
	<form
		method="POST"
		action="?/createMilestone"
		use:enhance={() => {
			return async ({ update }) => {
				await update();
				msCreateOpen = false;
			};
		}}
		class="space-y-4"
	>
		<div>
			<label for="ms-c-title" class="mb-1 block text-sm font-medium text-foreground">Title *</label
			>
			<input
				id="ms-c-title"
				name="title"
				required
				class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
			/>
		</div>
		<div>
			<label for="ms-c-desc" class="mb-1 block text-sm font-medium text-foreground"
				>Description</label
			>
			<textarea
				id="ms-c-desc"
				name="description"
				rows="2"
				class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
			></textarea>
		</div>
		<div class="grid grid-cols-2 gap-4">
			<div>
				<label for="ms-c-amount" class="mb-1 block text-sm font-medium text-foreground"
					>Amount ($)</label
				>
				<input
					id="ms-c-amount"
					name="amount"
					type="number"
					step="0.01"
					min="0"
					value="0"
					class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
				/>
			</div>
			<div>
				<label for="ms-c-status" class="mb-1 block text-sm font-medium text-foreground"
					>Status</label
				>
				<select
					id="ms-c-status"
					name="status"
					class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
				>
					{#each MILESTONE_STATUSES as s}
						<option value={s}>{s.replace(/_/g, ' ')}</option>
					{/each}
				</select>
			</div>
		</div>
		<div class="grid grid-cols-2 gap-4">
			<div>
				<label for="ms-c-due" class="mb-1 block text-sm font-medium text-foreground"
					>Due Date</label
				>
				<input
					id="ms-c-due"
					name="due_date"
					type="date"
					class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
				/>
			</div>
			<div>
				<label for="ms-c-paid" class="mb-1 block text-sm font-medium text-foreground"
					>Paid Date</label
				>
				<input
					id="ms-c-paid"
					name="paid_date"
					type="date"
					class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
				/>
			</div>
		</div>
		<div>
			<label for="ms-c-notes" class="mb-1 block text-sm font-medium text-foreground">Notes</label>
			<textarea
				id="ms-c-notes"
				name="notes"
				rows="2"
				class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
			></textarea>
		</div>
		<div class="flex justify-end gap-3 pt-2">
			<button
				type="button"
				onclick={() => (msCreateOpen = false)}
				class="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/80"
				>Cancel</button
			>
			<button
				type="submit"
				class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
				>Create Milestone</button
			>
		</div>
	</form>
</Modal>

<!-- ── Edit Milestone ────────────────────────────── -->
<Modal bind:open={msEditOpen} title="Edit Milestone">
	{#if msEditing}
		<form
			method="POST"
			action="?/updateMilestone"
			use:enhance={() => {
				return async ({ update }) => {
					await update();
					msEditOpen = false;
				};
			}}
			class="space-y-4"
		>
			<input type="hidden" name="id" value={msEditing.id} />
			<div>
				<label for="ms-e-title" class="mb-1 block text-sm font-medium text-foreground"
					>Title *</label
				>
				<input
					id="ms-e-title"
					name="title"
					required
					value={msEditing.title}
					class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
				/>
			</div>
			<div>
				<label for="ms-e-desc" class="mb-1 block text-sm font-medium text-foreground"
					>Description</label
				>
				<textarea
					id="ms-e-desc"
					name="description"
					rows="2"
					class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
					>{msEditing.description}</textarea
				>
			</div>
			<div class="grid grid-cols-2 gap-4">
				<div>
					<label for="ms-e-amount" class="mb-1 block text-sm font-medium text-foreground"
						>Amount ($)</label
					>
					<input
						id="ms-e-amount"
						name="amount"
						type="number"
						step="0.01"
						min="0"
						value={msEditing.amount}
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
					/>
				</div>
				<div>
					<label for="ms-e-status" class="mb-1 block text-sm font-medium text-foreground"
						>Status</label
					>
					<select
						id="ms-e-status"
						name="status"
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
					>
						{#each MILESTONE_STATUSES as s}
							<option value={s} selected={msEditing.status === s}
								>{s.replace(/_/g, ' ')}</option
							>
						{/each}
					</select>
				</div>
			</div>
			<div class="grid grid-cols-2 gap-4">
				<div>
					<label for="ms-e-due" class="mb-1 block text-sm font-medium text-foreground"
						>Due Date</label
					>
					<input
						id="ms-e-due"
						name="due_date"
						type="date"
						value={msEditing.due_date ?? ''}
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
					/>
				</div>
				<div>
					<label for="ms-e-paid" class="mb-1 block text-sm font-medium text-foreground"
						>Paid Date</label
					>
					<input
						id="ms-e-paid"
						name="paid_date"
						type="date"
						value={msEditing.paid_date ?? ''}
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
					/>
				</div>
			</div>
			<div>
				<label for="ms-e-notes" class="mb-1 block text-sm font-medium text-foreground"
					>Notes</label
				>
				<textarea
					id="ms-e-notes"
					name="notes"
					rows="2"
					class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
					>{msEditing.notes}</textarea
				>
			</div>
			<div class="flex justify-end gap-3 pt-2">
				<button
					type="button"
					onclick={() => (msEditOpen = false)}
					class="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/80"
					>Cancel</button
				>
				<button
					type="submit"
					class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
					>Save Changes</button
				>
			</div>
		</form>
	{/if}
</Modal>

<!-- ── Delete Milestone ──────────────────────────── -->
<Modal bind:open={msDeleteOpen} title="Delete Milestone">
	<form
		method="POST"
		action="?/deleteMilestone"
		use:enhance={() => {
			return async ({ update }) => {
				await update();
				msDeleteOpen = false;
			};
		}}
	>
		<input type="hidden" name="id" value={msDeletingId} />
		<div class="flex items-start gap-3">
			<AlertTriangle size={24} class="mt-0.5 shrink-0 text-red-400" />
			<p class="text-sm text-muted-foreground">
				This will permanently delete this milestone. Any payments linked to it will remain but lose
				their milestone reference.
			</p>
		</div>
		<div class="mt-6 flex justify-end gap-3">
			<button
				type="button"
				onclick={() => (msDeleteOpen = false)}
				class="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/80"
				>Cancel</button
			>
			<button
				type="submit"
				class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
				>Delete</button
			>
		</div>
	</form>
</Modal>

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
		<div class="grid grid-cols-2 gap-4">
			<div>
				<label for="pay-c-amount" class="mb-1 block text-sm font-medium text-foreground"
					>Amount ($) *</label
				>
				<input
					id="pay-c-amount"
					name="amount"
					type="number"
					step="0.01"
					min="0.01"
					required
					class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
				/>
			</div>
			<div>
				<label for="pay-c-method" class="mb-1 block text-sm font-medium text-foreground"
					>Method</label
				>
				<select
					id="pay-c-method"
					name="payment_method"
					class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
				>
					<option value="">None</option>
					{#each PAYMENT_METHODS as m}
						<option value={m}>{m.replace(/_/g, ' ')}</option>
					{/each}
				</select>
			</div>
		</div>
		<div class="grid grid-cols-2 gap-4">
			<div>
				<label for="pay-c-milestone" class="mb-1 block text-sm font-medium text-foreground"
					>Milestone</label
				>
				<select
					id="pay-c-milestone"
					name="milestone_id"
					class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
				>
					<option value="">None</option>
					{#each data.milestones as ms}
						<option value={ms.id}>{ms.title} ({fmt(Number(ms.amount))})</option>
					{/each}
				</select>
			</div>
			<div>
				<label for="pay-c-date" class="mb-1 block text-sm font-medium text-foreground"
					>Date</label
				>
				<input
					id="pay-c-date"
					name="paid_at"
					type="date"
					value={new Date().toISOString().slice(0, 10)}
					class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
				/>
			</div>
		</div>
		<div>
			<label for="pay-c-notes" class="mb-1 block text-sm font-medium text-foreground">Notes</label
			>
			<textarea
				id="pay-c-notes"
				name="notes"
				rows="2"
				class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
			></textarea>
		</div>
		<div class="flex justify-end gap-3 pt-2">
			<button
				type="button"
				onclick={() => (payCreateOpen = false)}
				class="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/80"
				>Cancel</button
			>
			<button
				type="submit"
				class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
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
			<div class="grid grid-cols-2 gap-4">
				<div>
					<label for="pay-e-amount" class="mb-1 block text-sm font-medium text-foreground"
						>Amount ($) *</label
					>
					<input
						id="pay-e-amount"
						name="amount"
						type="number"
						step="0.01"
						min="0.01"
						required
						value={payEditing.amount}
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
					/>
				</div>
				<div>
					<label for="pay-e-method" class="mb-1 block text-sm font-medium text-foreground"
						>Method</label
					>
					<select
						id="pay-e-method"
						name="payment_method"
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
					>
						<option value="">None</option>
						{#each PAYMENT_METHODS as m}
							<option value={m} selected={payEditing.payment_method === m}
								>{m.replace(/_/g, ' ')}</option
							>
						{/each}
					</select>
				</div>
			</div>
			<div class="grid grid-cols-2 gap-4">
				<div>
					<label for="pay-e-milestone" class="mb-1 block text-sm font-medium text-foreground"
						>Milestone</label
					>
					<select
						id="pay-e-milestone"
						name="milestone_id"
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
					>
						<option value="">None</option>
						{#each data.milestones as ms}
							<option value={ms.id} selected={payEditing.milestone_id === ms.id}
								>{ms.title} ({fmt(Number(ms.amount))})</option
							>
						{/each}
					</select>
				</div>
				<div>
					<label for="pay-e-date" class="mb-1 block text-sm font-medium text-foreground"
						>Date</label
					>
					<input
						id="pay-e-date"
						name="paid_at"
						type="date"
						value={payEditing.paid_at}
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
					/>
				</div>
			</div>
			<div>
				<label for="pay-e-notes" class="mb-1 block text-sm font-medium text-foreground"
					>Notes</label
				>
				<textarea
					id="pay-e-notes"
					name="notes"
					rows="2"
					class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
					>{payEditing.notes}</textarea
				>
			</div>
			<div class="flex justify-end gap-3 pt-2">
				<button
					type="button"
					onclick={() => (payEditOpen = false)}
					class="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/80"
					>Cancel</button
				>
				<button
					type="submit"
					class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
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
		<div class="flex items-start gap-3">
			<AlertTriangle size={24} class="mt-0.5 shrink-0 text-red-400" />
			<p class="text-sm text-muted-foreground">
				This will permanently delete this payment record. This action cannot be undone.
			</p>
		</div>
		<div class="mt-6 flex justify-end gap-3">
			<button
				type="button"
				onclick={() => (payDeleteOpen = false)}
				class="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/80"
				>Cancel</button
			>
			<button
				type="submit"
				class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
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
			<label for="exp-c-title" class="mb-1 block text-sm font-medium text-foreground"
				>Title *</label
			>
			<input
				id="exp-c-title"
				name="title"
				required
				class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
			/>
		</div>
		<div class="grid grid-cols-2 gap-4">
			<div>
				<label for="exp-c-amount" class="mb-1 block text-sm font-medium text-foreground"
					>Amount ($)</label
				>
				<input
					id="exp-c-amount"
					name="amount"
					type="number"
					step="0.01"
					min="0"
					value="0"
					class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
				/>
			</div>
			<div>
				<label for="exp-c-cat" class="mb-1 block text-sm font-medium text-foreground"
					>Category</label
				>
				<select
					id="exp-c-cat"
					name="category"
					class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
				>
					<option value="">None</option>
					{#each EXPENSE_CATEGORIES as c}
						<option value={c}>{c.replace(/_/g, ' ')}</option>
					{/each}
				</select>
			</div>
		</div>
		<div>
			<label for="exp-c-date" class="mb-1 block text-sm font-medium text-foreground">Date</label>
			<input
				id="exp-c-date"
				name="spent_at"
				type="date"
				value={new Date().toISOString().slice(0, 10)}
				class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
			/>
		</div>
		<div>
			<label for="exp-c-notes" class="mb-1 block text-sm font-medium text-foreground">Notes</label
			>
			<textarea
				id="exp-c-notes"
				name="notes"
				rows="2"
				class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
			></textarea>
		</div>
		<div class="flex justify-end gap-3 pt-2">
			<button
				type="button"
				onclick={() => (expCreateOpen = false)}
				class="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/80"
				>Cancel</button
			>
			<button
				type="submit"
				class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
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
				<label for="exp-e-title" class="mb-1 block text-sm font-medium text-foreground"
					>Title *</label
				>
				<input
					id="exp-e-title"
					name="title"
					required
					value={expEditing.title}
					class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
				/>
			</div>
			<div class="grid grid-cols-2 gap-4">
				<div>
					<label for="exp-e-amount" class="mb-1 block text-sm font-medium text-foreground"
						>Amount ($)</label
					>
					<input
						id="exp-e-amount"
						name="amount"
						type="number"
						step="0.01"
						min="0"
						value={expEditing.amount}
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
					/>
				</div>
				<div>
					<label for="exp-e-cat" class="mb-1 block text-sm font-medium text-foreground"
						>Category</label
					>
					<select
						id="exp-e-cat"
						name="category"
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
					>
						<option value="">None</option>
						{#each EXPENSE_CATEGORIES as c}
							<option value={c} selected={expEditing.category === c}
								>{c.replace(/_/g, ' ')}</option
							>
						{/each}
					</select>
				</div>
			</div>
			<div>
				<label for="exp-e-date" class="mb-1 block text-sm font-medium text-foreground">Date</label
				>
				<input
					id="exp-e-date"
					name="spent_at"
					type="date"
					value={expEditing.spent_at}
					class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
				/>
			</div>
			<div>
				<label for="exp-e-notes" class="mb-1 block text-sm font-medium text-foreground"
					>Notes</label
				>
				<textarea
					id="exp-e-notes"
					name="notes"
					rows="2"
					class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
					>{expEditing.notes}</textarea
				>
			</div>
			<div class="flex justify-end gap-3 pt-2">
				<button
					type="button"
					onclick={() => (expEditOpen = false)}
					class="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/80"
					>Cancel</button
				>
				<button
					type="submit"
					class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
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
		<div class="flex items-start gap-3">
			<AlertTriangle size={24} class="mt-0.5 shrink-0 text-red-400" />
			<p class="text-sm text-muted-foreground">
				This will permanently delete this expense record. This action cannot be undone.
			</p>
		</div>
		<div class="mt-6 flex justify-end gap-3">
			<button
				type="button"
				onclick={() => (expDeleteOpen = false)}
				class="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/80"
				>Cancel</button
			>
			<button
				type="submit"
				class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
				>Delete</button
			>
		</div>
	</form>
</Modal>

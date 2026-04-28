<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Markdown from '$lib/components/Markdown.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { Landmark, Plus, Pencil, Eye, CheckCircle2, AlertTriangle } from 'lucide-svelte';
	import {
		groupDbSlicesByPhase,
		groupDraftSlicesByPhase,
		normalizeSlicePhaseValue,
		type MilestoneWithRelations
	} from '$lib/milestone-shared';

	let { data } = $props();

	let msEditOpen = $state(false);
	let msDeleteOpen = $state(false);
	let msEditing: MilestoneWithRelations | null = $state(null);
	let msDeletingId = $state('');

	type SliceRow = {
		title: string;
		notes: string;
		estimate: string;
		owner_user_id: string;
		status: string;
		depends_on: string;
		phase: string;
	};

	function emptySlice(milestonePhase?: string): SliceRow {
		return {
			title: '',
			notes: '',
			estimate: '',
			owner_user_id: '',
			status: 'pending',
			depends_on: '',
			phase: normalizeSlicePhaseValue(milestonePhase)
		};
	}

	let msEditSlices = $state<SliceRow[]>([emptySlice()]);
	let msEditTitle = $state('');
	let msEditDescription = $state('');
	let msEditEstimate = $state('');
	let msEditEntryGate = $state('');
	let msEditExitGate = $state('');
	let msEditTestRequired = $state('');
	let msEditTestPass = $state('');
	let msEditTestEnv = $state('');
	let msEditRisks = $state('');
	let msEditDeps = $state('');
	let msEditDeliverables = $state('');
	let msEditApprovalOwnerId = $state('');

	let msEditAttachBill = $state<'yes' | 'no'>('no');

	let msEditDueDate = $state('');
	let msEditPriority = $state('p3_normal');
	let msEditPhase = $state('discovery');
	let msEditOwnerUserId = $state('');
	let msEditSpecId = $state('');
	let msEditNotes = $state('');
	let msEditAmount = $state('0');
	let msEditPaidDate = $state('');
	let msEditMilestoneStatus = $state('planned');
	let msEditBillAmount = $state('');
	let msEditBillStatus = $state('draft');

	type MsPreviewData =
		| { kind: 'saved'; milestone: MilestoneWithRelations }
		| {
				kind: 'draft';
				title: string;
				description: string;
				slices: SliceRow[];
				phase: string;
				priority: string;
				estimate: string;
				dueDate: string;
				ownerUserId: string;
				entryGate: string;
				exitGate: string;
				approvalOwnerUserId: string;
				testRequired: string;
				testPass: string;
				testEnv: string;
				risks: string;
				dependencies: string;
				deliverables: string;
			};

	let msPreviewOpen = $state(false);
	let msPreviewData = $state<MsPreviewData | null>(null);

	const MILESTONE_STATUSES = ['planned', 'active', 'ready_for_payment', 'paid', 'overdue'] as const;

	const PRIORITY_OPTIONS = [
		{ value: 'p1_critical', label: 'P1 Critical' },
		{ value: 'p2_high', label: 'P2 High' },
		{ value: 'p3_normal', label: 'P3 Normal' },
		{ value: 'p4_low', label: 'P4 Low' }
	] as const;

	const PHASE_OPTIONS = [
		{ value: 'discovery', label: 'Discovery' },
		{ value: 'planning', label: 'Planning' },
		{ value: 'execution', label: 'Execution' },
		{ value: 'internal_testing', label: 'Internal Testing' },
		{ value: 'client_review', label: 'Client Review' },
		{ value: 'approved', label: 'Approved' },
		{ value: 'released', label: 'Released' },
		{ value: 'blocked', label: 'Blocked' },
		{ value: 'closed', label: 'Closed' }
	] as const;

	const SLICE_STATUS_OPTIONS = [
		{ value: 'pending', label: 'Pending' },
		{ value: 'in_progress', label: 'In progress' },
		{ value: 'done', label: 'Done' },
		{ value: 'blocked', label: 'Blocked' }
	] as const;

	const BILL_STATUS_OPTIONS = [
		{ value: 'draft', label: 'Draft' },
		{ value: 'sent', label: 'Sent' },
		{ value: 'paid', label: 'Paid' },
		{ value: 'overdue', label: 'Overdue' }
	] as const;

	function milestonePhase(m: MilestoneWithRelations): string {
		const p = m.phase;
		if (PHASE_OPTIONS.some((o) => o.value === p)) return p as string;
		return 'discovery';
	}

	function orgUserName(id: string | null | undefined) {
		if (!id) return '';
		return data.orgUsers.find((u) => u.id === id)?.full_name ?? '';
	}

	function milestonePriority(m: MilestoneWithRelations): string {
		return m.priority ?? 'p3_normal';
	}

	function phaseLabel(v: string) {
		return PHASE_OPTIONS.find((p) => p.value === v)?.label ?? v.replace(/_/g, ' ');
	}

	function sliceStatusLabel(v: string) {
		return SLICE_STATUS_OPTIONS.find((s) => s.value === v)?.label ?? v.replace(/_/g, ' ');
	}

	function slicesJsonPayload(rows: SliceRow[]) {
		return JSON.stringify(
			rows
				.filter((s) => s.title.trim())
				.map((s) => ({
					title: s.title.trim(),
					notes: s.notes.trim(),
					estimate: s.estimate.trim(),
					owner_user_id: s.owner_user_id.trim() || null,
					depends_on: s.depends_on.trim() || null,
					status: s.status,
					phase: normalizeSlicePhaseValue(s.phase)
				}))
		);
	}

	function hydrateEditFields(ms: MilestoneWithRelations) {
		msEditEstimate = ms.estimate ?? '';
		msEditDueDate = ms.due_date ?? '';
		msEditPriority = milestonePriority(ms);
		msEditPhase = milestonePhase(ms);
		msEditOwnerUserId = ms.owner_user_id ?? '';
		msEditSpecId = ms.spec_id ?? '';
		msEditNotes = ms.notes ?? '';
		msEditAmount = String(ms.amount ?? 0);
		msEditPaidDate = ms.paid_date ?? '';
		msEditMilestoneStatus = ms.status;
		msEditBillAmount = ms.bill_amount != null ? String(ms.bill_amount) : '';
		msEditBillStatus = ms.bill_status ?? 'draft';
		msEditEntryGate = ms.entry_gate ?? '';
		msEditExitGate = ms.exit_gate ?? '';
		msEditTestRequired = ms.test_gate_required_tests ?? '';
		msEditTestPass = ms.test_gate_pass_threshold ?? '';
		msEditTestEnv = ms.test_gate_environment ?? '';
		msEditRisks = ms.risks_blockers ?? '';
		msEditDeps = ms.dependencies ?? '';
		msEditDeliverables = ms.deliverables ?? '';
		msEditApprovalOwnerId = ms.approval_owner_user_id ?? '';
		msEditAttachBill = ms.attach_bill ? 'yes' : 'no';
	}

	function buildDraftPreview(
		title: string,
		description: string,
		slices: SliceRow[],
		fields: {
			phase: string;
			priority: string;
			estimate: string;
			dueDate: string;
			ownerUserId: string;
			entryGate: string;
			exitGate: string;
			approvalOwnerUserId: string;
			testRequired: string;
			testPass: string;
			testEnv: string;
			risks: string;
			dependencies: string;
			deliverables: string;
		}
	): Extract<MsPreviewData, { kind: 'draft' }> {
		return { kind: 'draft', title, description, slices, ...fields };
	}

	function normalizeSliceStatus(s: string) {
		if (s === 'todo') return 'pending';
		if (SLICE_STATUS_OPTIONS.some((o) => o.value === s)) return s;
		return 'pending';
	}

	function plainDescriptionSnippet(md: string, max = 140) {
		return md
			.replace(/```[\s\S]*?```/g, ' ')
			.replace(/`[^`]+`/g, ' ')
			.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
			.replace(/^#{1,6}\s+/gm, '')
			.replace(/[*_~>#-]/g, '')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, max);
	}

	function fmtDate(d: string | null) {
		if (!d) return '--';
		return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function fmt(n: number) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
	}

	let showCreated = $state(false);
	onMount(() => {
		if (typeof window === 'undefined') return;
		const u = new URL(window.location.href);
		if (u.searchParams.get('created') === '1') {
			showCreated = true;
			u.searchParams.delete('created');
			goto(u.pathname + u.search, { replaceState: true, noScroll: true });
			setTimeout(() => {
				showCreated = false;
			}, 3200);
		}
	});
</script>

<PageHeader title="Milestones" description="Plan delivery as missions with lifecycle gates, quality checks, and slices.">
	{#snippet actions()}
		<a
			href="/projects/{$page.params.id}/milestone/new"
			class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
		>
			<Plus size={16} />
			New milestone
		</a>
	{/snippet}
</PageHeader>

{#if showCreated}
	<div
		transition:fade={{ duration: 200 }}
		class="mt-3 flex items-center gap-2.5 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-200"
		role="status"
		aria-live="polite"
	>
		<CheckCircle2 size={20} class="shrink-0 text-emerald-400" strokeWidth={2.25} />
		<span>Milestone created successfully</span>
	</div>
{/if}

	{#if data.milestones.length === 0}
		<div class="mt-12 text-center">
			<Landmark size={48} class="mx-auto text-muted-foreground/40" />
			<p class="mt-4 text-lg font-semibold text-foreground">No milestones yet</p>
			<p class="mt-1 text-sm text-muted-foreground">Add a milestone to capture lifecycle, gates, and slices.</p>
			<a
				href="/projects/{$page.params.id}/milestone/new"
				class="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
			>
				<Plus size={16} />
				Create your first milestone
			</a>
		</div>
	{:else}
		<div class="mt-6 space-y-6">
			{#each data.milestones as ms}
				<article class="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
					<div class="border-b border-border p-4 sm:p-5">
						<div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
							<div class="min-w-0 flex-1">
								<div class="flex flex-wrap items-center gap-2">
									<h2 class="text-lg font-semibold tracking-tight text-foreground">{ms.title}</h2>
									<StatusBadge status={ms.status} size="sm" />
								</div>
								<p class="mt-1 text-xl font-bold tabular-nums text-foreground">
									{fmt(Number(ms.amount))}
								</p>
								<div class="mt-2 flex flex-wrap gap-1.5">
									<StatusBadge status={milestonePhase(ms)} size="sm" />
									<StatusBadge status={milestonePriority(ms)} size="sm" />
									{#if ms.slices.length > 0}
										<span
											class="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground"
										>
											{ms.slices.length} slice{ms.slices.length === 1 ? '' : 's'}
										</span>
									{/if}
								</div>
								{#if ms.description}
									<p class="mt-2 text-sm text-muted-foreground line-clamp-2">
										{plainDescriptionSnippet(ms.description)}
									</p>
								{/if}
								<div class="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
									<span
										>Due <span class="font-medium text-foreground">{fmtDate(ms.due_date)}</span></span
									>
									<span
										>Paid <span class="font-medium text-foreground">{fmtDate(ms.paid_date)}</span></span
									>
								</div>
							</div>
							<div class="flex shrink-0 flex-wrap gap-2">
								<button
									type="button"
									onclick={() => {
										msPreviewData = { kind: 'saved', milestone: ms };
										msPreviewOpen = true;
									}}
									class="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary"
								>
									<Eye size={14} />
									Preview
								</button>
								<button
									type="button"
									onclick={() => {
										msEditing = ms;
										msEditTitle = ms.title;
										msEditDescription = ms.description ?? '';
										hydrateEditFields(ms);
										msEditSlices =
											ms.slices.length > 0
												? ms.slices.map((s) => ({
														title: s.title,
														notes: s.notes ?? '',
														estimate: s.estimate ?? '',
														owner_user_id: s.owner_user_id ?? '',
														status: normalizeSliceStatus(s.status),
														depends_on: s.depends_on ?? '',
														phase: normalizeSlicePhaseValue(s.phase)
													}))
												: [emptySlice(msEditPhase)];
										msEditOpen = true;
									}}
									class="rounded-lg bg-secondary px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary/80"
								>
									Edit
								</button>
								<button
									type="button"
									onclick={() => {
										msDeletingId = ms.id;
										msDeleteOpen = true;
									}}
									class="rounded-lg bg-red-900/30 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-900/50"
								>
									Delete
								</button>
							</div>
						</div>
					</div>

					{#if ms.slices.length > 0}
						<div class="space-y-5 p-4 sm:p-5 sm:pt-4">
							{#each groupDbSlicesByPhase(ms.slices) as group}
								<div>
									<h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">
										{phaseLabel(group.phase)}
									</h3>
									<ul class="space-y-2">
										{#each group.slices as sl}
											<li class="rounded-lg border border-border bg-secondary/15 p-3">
												<div class="flex flex-wrap items-start justify-between gap-2">
													<p class="min-w-0 text-sm font-medium text-foreground">{sl.title}</p>
													<StatusBadge status={normalizeSliceStatus(sl.status)} size="sm" />
												</div>
												{#if sl.notes?.trim()}
													<p class="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
														{sl.notes}
													</p>
												{/if}
												<dl class="mt-2 grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
													{#if sl.estimate?.trim()}
														<div>
															<span class="text-muted-foreground">Estimate</span>
															<span class="ml-1 font-medium text-foreground">{sl.estimate}</span>
														</div>
													{/if}
													{#if sl.owner_user_id}
														<div>
															<span class="text-muted-foreground">Owner</span>
															<span class="ml-1 font-medium text-foreground">
																{orgUserName(sl.owner_user_id) || '—'}
															</span>
														</div>
													{/if}
													{#if sl.depends_on?.trim()}
														<div class="sm:col-span-2">
															<span class="text-muted-foreground">Dependency</span>
															<span class="ml-1 font-medium text-foreground">{sl.depends_on}</span>
														</div>
													{/if}
												</dl>
											</li>
										{/each}
									</ul>
								</div>
							{/each}
						</div>
					{:else}
						<div class="border-t border-border px-4 py-3 sm:px-5">
							<p class="text-xs text-muted-foreground">
								No slices yet — edit this milestone to add work slices by phase.
							</p>
						</div>
					{/if}
				</article>
			{/each}
		</div>
	{/if}

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
		class="flex max-h-[min(85vh,48rem)] flex-col"
	>
		<input type="hidden" name="id" value={msEditing.id} />
			<input type="hidden" name="slices_json" value={slicesJsonPayload(msEditSlices)} />
			<div class="space-y-6 overflow-y-auto pr-1">
				<div>
					<p class="mb-3 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Section 1 · Overview
					</p>
					<div class="space-y-4">
						<div>
							<label for="ms-e-title" class="mb-1 block text-sm font-medium text-foreground"
								>Title *</label
							>
							<input
								id="ms-e-title"
								name="title"
								required
								bind:value={msEditTitle}
								class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
							/>
						</div>
						<div>
							<div class="mb-1 flex flex-wrap items-center justify-between gap-2">
								<label for="ms-e-desc" class="block text-sm font-medium text-foreground"
									>Description *</label
								>
								<button
									type="button"
									onclick={() => {
										msPreviewData = buildDraftPreview(
											msEditTitle,
											msEditDescription,
											msEditSlices.map((s) => ({ ...s })),
											{
												phase: msEditPhase,
												priority: msEditPriority,
												estimate: msEditEstimate,
												dueDate: msEditDueDate,
												ownerUserId: msEditOwnerUserId,
												entryGate: msEditEntryGate,
												exitGate: msEditExitGate,
												approvalOwnerUserId: msEditApprovalOwnerId,
												testRequired: msEditTestRequired,
												testPass: msEditTestPass,
												testEnv: msEditTestEnv,
												risks: msEditRisks,
												dependencies: msEditDeps,
												deliverables: msEditDeliverables
											}
										);
										msPreviewOpen = true;
									}}
									class="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
								>
									<Eye size={14} />
									Preview
								</button>
							</div>
							<p class="mb-1.5 text-xs text-muted-foreground">
								Markdown supported (headings, lists, links, code blocks, etc.).
							</p>
							<textarea
								id="ms-e-desc"
								name="description"
								rows="6"
								required
								bind:value={msEditDescription}
								class="min-h-[8rem] w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground"
							></textarea>
						</div>
						<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div>
								<label for="ms-e-priority" class="mb-1 block text-sm font-medium text-foreground"
									>Priority *</label
								>
								<select
									id="ms-e-priority"
									name="priority"
									bind:value={msEditPriority}
									class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
								>
									{#each PRIORITY_OPTIONS as p}
										<option value={p.value}>{p.label}</option>
									{/each}
								</select>
							</div>
							<div>
								<label for="ms-e-owner" class="mb-1 block text-sm font-medium text-foreground"
									>Owner</label
								>
								<select
									id="ms-e-owner"
									name="owner_user_id"
									bind:value={msEditOwnerUserId}
									class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
								>
									<option value="">None</option>
									{#each data.orgUsers as u}
										<option value={u.id}>{u.full_name}</option>
									{/each}
								</select>
							</div>
						</div>
						<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
							<div>
								<label for="ms-e-est" class="mb-1 block text-sm font-medium text-foreground"
									>Estimate *</label
								>
								<input
									id="ms-e-est"
									name="estimate"
									required
									bind:value={msEditEstimate}
									class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
								/>
							</div>
							<div>
								<label for="ms-e-due" class="mb-1 block text-sm font-medium text-foreground"
									>Due date *</label
								>
								<input
									id="ms-e-due"
									name="due_date"
									type="date"
									required
									bind:value={msEditDueDate}
									class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
								/>
							</div>
						</div>
					</div>
				</div>

				<div>
					<p class="mb-3 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Section 2 · Lifecycle
					</p>
					<div class="space-y-4">
						<div>
							<label for="ms-e-phase" class="mb-1 block text-sm font-medium text-foreground"
								>Current phase *</label
							>
							<p class="mb-1.5 text-xs text-muted-foreground">
								Milestone stage (broader than individual task status).
							</p>
							<select
								id="ms-e-phase"
								name="phase"
								bind:value={msEditPhase}
								class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
							>
								{#each PHASE_OPTIONS as p}
									<option value={p.value}>{p.label}</option>
								{/each}
							</select>
						</div>
						<div>
							<label for="ms-e-entry" class="mb-1 block text-sm font-medium text-foreground"
								>Entry gate *</label
							>
							<p class="mb-1.5 text-xs text-muted-foreground">What must be true before this milestone starts.</p>
							<textarea
								id="ms-e-entry"
								name="entry_gate"
								rows="3"
								required
								bind:value={msEditEntryGate}
								class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
							></textarea>
						</div>
						<div>
							<label for="ms-e-exit" class="mb-1 block text-sm font-medium text-foreground"
								>Exit / completion gate *</label
							>
							<p class="mb-1.5 text-xs text-muted-foreground">What must be true before this milestone is marked complete.</p>
							<textarea
								id="ms-e-exit"
								name="exit_gate"
								rows="3"
								required
								bind:value={msEditExitGate}
								class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
							></textarea>
						</div>
						<div>
							<label for="ms-e-approval-owner" class="mb-1 block text-sm font-medium text-foreground"
								>Approval owner *</label
							>
							<select
								id="ms-e-approval-owner"
								name="approval_owner_user_id"
								required
								bind:value={msEditApprovalOwnerId}
								class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
							>
								<option value="">Select who signs off *</option>
								{#each data.orgUsers as u}
									<option value={u.id}>{u.full_name}</option>
								{/each}
							</select>
						</div>
					</div>
				</div>

				<div>
					<p class="mb-3 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Section 3 · Quality
					</p>
					<div class="space-y-4">
						<div class="rounded-lg border border-border bg-secondary/20 p-3">
							<p class="text-sm font-medium text-foreground">Test gate *</p>
							<p class="mt-0.5 text-xs text-muted-foreground">Specific verification required before completion.</p>
							<div class="mt-3 space-y-3">
								<div>
									<label for="ms-e-treq" class="mb-1 block text-xs font-medium text-muted-foreground"
										>Required tests</label
									>
									<textarea
										id="ms-e-treq"
										name="test_gate_required_tests"
										rows="2"
										required
										bind:value={msEditTestRequired}
										class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
									></textarea>
								</div>
								<div>
									<label for="ms-e-tpass" class="mb-1 block text-xs font-medium text-muted-foreground"
										>Pass threshold</label
									>
									<input
										id="ms-e-tpass"
										name="test_gate_pass_threshold"
										required
										bind:value={msEditTestPass}
										class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
									/>
								</div>
								<div>
									<label for="ms-e-tenv" class="mb-1 block text-xs font-medium text-muted-foreground"
										>Environment tested on</label
									>
									<input
										id="ms-e-tenv"
										name="test_gate_environment"
										required
										bind:value={msEditTestEnv}
										class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
									/>
								</div>
							</div>
						</div>
						<div>
							<label for="ms-e-risks" class="mb-1 block text-sm font-medium text-foreground"
								>Risks / blockers</label
							>
							<textarea
								id="ms-e-risks"
								name="risks_blockers"
								rows="2"
								bind:value={msEditRisks}
								class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
							></textarea>
						</div>
						<div>
							<label for="ms-e-deps" class="mb-1 block text-sm font-medium text-foreground"
								>Dependencies</label
							>
							<textarea
								id="ms-e-deps"
								name="dependencies"
								rows="2"
								bind:value={msEditDeps}
								class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
							></textarea>
						</div>
						<div>
							<label for="ms-e-deliverables" class="mb-1 block text-sm font-medium text-foreground"
								>Deliverables</label
							>
							<textarea
								id="ms-e-deliverables"
								name="deliverables"
								rows="2"
								bind:value={msEditDeliverables}
								class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
							></textarea>
						</div>
					</div>
				</div>

				<div>
					<p class="mb-3 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Section 4 · Slices
					</p>
					<p class="mb-3 text-xs text-muted-foreground">
						Assign each slice to a lifecycle phase (Discovery → Closed). Phases organize work on the list and in previews.
					</p>
					<div class="space-y-3">
						{#each msEditSlices as row, i (i)}
							<div class="space-y-3 rounded-lg border border-border bg-secondary/20 p-3">
								<div class="flex items-center justify-between gap-2">
									<span class="text-xs font-medium text-muted-foreground">Slice {i + 1}</span>
									<button
										type="button"
										onclick={() => {
											msEditSlices = msEditSlices.filter((_, j) => j !== i);
											if (msEditSlices.length === 0) msEditSlices = [emptySlice(msEditPhase)];
										}}
										class="rounded-lg border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary"
									>
										Remove
									</button>
								</div>
								<input
									bind:value={row.title}
									placeholder="Slice title *"
									class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground"
								/>
								<div>
									<label
										class="mb-1 block text-xs font-medium text-muted-foreground"
										for="ms-e-slice-phase-{i}">Phase</label
									>
									<select
										id="ms-e-slice-phase-{i}"
										bind:value={row.phase}
										class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
									>
										{#each PHASE_OPTIONS as p}
											<option value={p.value}>{p.label}</option>
										{/each}
									</select>
								</div>
								<div>
									<label class="mb-1 block text-xs font-medium text-muted-foreground" for="ms-e-slice-notes-{i}"
										>Notes</label
									>
									<textarea
										id="ms-e-slice-notes-{i}"
										bind:value={row.notes}
										rows="2"
										placeholder="Context, acceptance hints, or investigation notes"
										class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
									></textarea>
								</div>
								<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
									<div>
										<label class="mb-1 block text-xs font-medium text-muted-foreground" for="ms-e-slice-owner-{i}"
											>Owner</label
										>
										<select
											id="ms-e-slice-owner-{i}"
											bind:value={row.owner_user_id}
											class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
										>
											<option value="">None</option>
											{#each data.orgUsers as u}
												<option value={u.id}>{u.full_name}</option>
											{/each}
										</select>
									</div>
									<div>
										<label class="mb-1 block text-xs font-medium text-muted-foreground" for="ms-e-slice-est-{i}"
											>Estimate</label
										>
										<input
											id="ms-e-slice-est-{i}"
											bind:value={row.estimate}
											placeholder="e.g. 2h"
											class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
										/>
									</div>
									<div>
										<label class="mb-1 block text-xs font-medium text-muted-foreground" for="ms-e-slice-st-{i}"
											>Status</label
										>
										<select
											id="ms-e-slice-st-{i}"
											bind:value={row.status}
											class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
										>
											{#each SLICE_STATUS_OPTIONS as s}
												<option value={s.value}>{s.label}</option>
											{/each}
										</select>
									</div>
									<div>
										<label class="mb-1 block text-xs font-medium text-muted-foreground" for="ms-e-slice-dep-{i}"
											>Dependency (optional)</label
										>
										<input
											id="ms-e-slice-dep-{i}"
											bind:value={row.depends_on}
											placeholder="e.g. Another slice title or external dependency"
											class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
										/>
									</div>
								</div>
							</div>
						{/each}
					</div>
					<button
						type="button"
						onclick={() => {
							msEditSlices = [...msEditSlices, emptySlice(msEditPhase)];
						}}
						class="mt-3 text-sm font-medium text-primary hover:underline"
					>
						+ Add slice
					</button>
				</div>

				<div>
					<p class="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Optional links</p>
					<div class="space-y-4">
						<div>
							<label for="ms-e-spec" class="mb-1 block text-sm font-medium text-foreground"
								>Linked spec</label
							>
							<select
								id="ms-e-spec"
								name="spec_id"
								bind:value={msEditSpecId}
								class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
							>
								<option value="">None</option>
								{#each data.specs as sp}
									<option value={sp.id}>{sp.title}</option>
								{/each}
							</select>
						</div>
						{#if data.tasks.length > 0}
							<div>
								<p class="mb-2 text-sm font-medium text-foreground">Linked tasks</p>
								<div
									class="max-h-36 space-y-2 overflow-y-auto rounded-lg border border-border bg-background p-3"
								>
									{#each data.tasks as t}
										<label class="flex cursor-pointer items-center gap-2 text-sm text-foreground">
											<input
												type="checkbox"
												name="linked_task_id"
												value={t.id}
												checked={msEditing.linked_task_ids.includes(t.id)}
												class="rounded border-border"
											/>
											<span class="truncate">{t.title}</span>
										</label>
									{/each}
								</div>
							</div>
						{/if}
						<div>
							<label for="ms-e-notes" class="mb-1 block text-sm font-medium text-foreground"
								>Notes</label
							>
							<textarea
								id="ms-e-notes"
								name="notes"
								rows="2"
								bind:value={msEditNotes}
								class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
							></textarea>
						</div>
					</div>
				</div>

				<div class="rounded-lg border border-dashed border-border p-4">
					<p class="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Section 5 · Finance (optional)
					</p>
					<p class="mb-3 text-xs text-muted-foreground">Budget tracking and bill attachment for this milestone.</p>
					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div>
							<label for="ms-e-amount" class="mb-1 block text-sm font-medium text-foreground"
								>Budget amount ($)</label
							>
							<input
								id="ms-e-amount"
								name="amount"
								type="number"
								step="0.01"
								min="0"
								bind:value={msEditAmount}
								class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
							/>
						</div>
						<div>
							<label for="ms-e-status" class="mb-1 block text-sm font-medium text-foreground"
								>Payment status</label
							>
							<select
								id="ms-e-status"
								name="status"
								bind:value={msEditMilestoneStatus}
								class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
							>
								{#each MILESTONE_STATUSES as s}
									<option value={s}>{s.replace(/_/g, ' ')}</option>
								{/each}
							</select>
						</div>
					</div>
					<div class="mt-3">
						<label for="ms-e-paid" class="mb-1 block text-sm font-medium text-foreground"
							>Paid date</label
						>
						<input
							id="ms-e-paid"
							name="paid_date"
							type="date"
							bind:value={msEditPaidDate}
							class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground sm:max-w-xs"
						/>
					</div>
					<div class="mt-4 border-t border-border pt-4">
						<label for="ms-e-attach-bill" class="mb-1 block text-sm font-medium text-foreground"
							>Attach bill</label
						>
						<select
							id="ms-e-attach-bill"
							name="attach_bill"
							bind:value={msEditAttachBill}
							class="w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
						>
							<option value="no">No</option>
							<option value="yes">Yes</option>
						</select>
						{#if msEditAttachBill === 'yes'}
							<div class="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
								<div>
									<label for="ms-e-bill-amt" class="mb-1 block text-sm font-medium text-foreground"
										>Bill amount ($) *</label
									>
									<input
										id="ms-e-bill-amt"
										name="bill_amount"
										type="number"
										step="0.01"
										min="0"
										required
										bind:value={msEditBillAmount}
										class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
									/>
								</div>
								<div>
									<label for="ms-e-bill-st" class="mb-1 block text-sm font-medium text-foreground"
										>Bill status *</label
									>
									<select
										id="ms-e-bill-st"
										name="bill_status"
										required
										bind:value={msEditBillStatus}
										class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
									>
										{#each BILL_STATUS_OPTIONS as b}
											<option value={b.value}>{b.label}</option>
										{/each}
									</select>
								</div>
							</div>
						{/if}
					</div>
				</div>
			</div>
			<div class="mt-4 flex shrink-0 justify-end gap-3 border-t border-border pt-4">
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

<Modal bind:open={msPreviewOpen} title="Milestone preview">
	{#if msPreviewData && msPreviewData.kind === 'saved'}
		{@const m = msPreviewData.milestone}
		<div class="max-h-[min(80vh,40rem)] space-y-5 overflow-y-auto pr-1 text-sm">
			<div>
				<h3 class="text-lg font-semibold text-foreground">{m.title}</h3>
				<div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
					<StatusBadge status={milestonePhase(m)} size="sm" />
					<StatusBadge status={milestonePriority(m)} size="sm" />
					<StatusBadge status={m.status} size="sm" />
					<span>Due {fmtDate(m.due_date)}</span>
					{#if m.estimate}
						<span>&middot; Est. {m.estimate}</span>
					{/if}
					{#if m.owner_user_id}
						<span>&middot; Owner {orgUserName(m.owner_user_id) || '—'}</span>
					{/if}
				</div>
			</div>

			<div>
				<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overview</p>
				<div class="rounded-lg border border-border bg-background/50 p-3">
					{#if m.description?.trim()}
						<Markdown content={m.description} />
					{:else}
						<p class="text-sm text-muted-foreground">No description.</p>
					{/if}
				</div>
			</div>

			<div>
				<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lifecycle</p>
				<dl class="space-y-2 rounded-lg border border-border bg-secondary/10 p-3 text-sm">
					<div>
						<dt class="text-xs font-medium text-muted-foreground">Current phase</dt>
						<dd class="mt-0.5 text-foreground">{phaseLabel(milestonePhase(m))}</dd>
					</div>
					<div>
						<dt class="text-xs font-medium text-muted-foreground">Entry gate</dt>
						<dd class="mt-0.5 whitespace-pre-wrap text-foreground">{m.entry_gate || '—'}</dd>
					</div>
					<div>
						<dt class="text-xs font-medium text-muted-foreground">Exit / completion gate</dt>
						<dd class="mt-0.5 whitespace-pre-wrap text-foreground">{m.exit_gate || '—'}</dd>
					</div>
					<div>
						<dt class="text-xs font-medium text-muted-foreground">Approval owner</dt>
						<dd class="mt-0.5 text-foreground">
							{orgUserName(m.approval_owner_user_id) || '—'}
						</dd>
					</div>
				</dl>
			</div>

			<div>
				<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quality</p>
				<dl class="space-y-2 rounded-lg border border-border bg-secondary/10 p-3 text-sm">
					<div>
						<dt class="text-xs font-medium text-muted-foreground">Required tests</dt>
						<dd class="mt-0.5 whitespace-pre-wrap text-foreground">{m.test_gate_required_tests || '—'}</dd>
					</div>
					<div>
						<dt class="text-xs font-medium text-muted-foreground">Pass threshold</dt>
						<dd class="mt-0.5 text-foreground">{m.test_gate_pass_threshold || '—'}</dd>
					</div>
					<div>
						<dt class="text-xs font-medium text-muted-foreground">Environment tested on</dt>
						<dd class="mt-0.5 text-foreground">{m.test_gate_environment || '—'}</dd>
					</div>
					{#if m.risks_blockers?.trim()}
						<div>
							<dt class="text-xs font-medium text-muted-foreground">Risks / blockers</dt>
							<dd class="mt-0.5 whitespace-pre-wrap text-foreground">{m.risks_blockers}</dd>
						</div>
					{/if}
					{#if m.dependencies?.trim()}
						<div>
							<dt class="text-xs font-medium text-muted-foreground">Dependencies</dt>
							<dd class="mt-0.5 whitespace-pre-wrap text-foreground">{m.dependencies}</dd>
						</div>
					{/if}
					{#if m.deliverables?.trim()}
						<div>
							<dt class="text-xs font-medium text-muted-foreground">Deliverables</dt>
							<dd class="mt-0.5 whitespace-pre-wrap text-foreground">{m.deliverables}</dd>
						</div>
					{/if}
				</dl>
			</div>

			{#if m.slices.length > 0}
				<div>
					<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Slices by phase
					</p>
					<div class="space-y-4">
						{#each groupDbSlicesByPhase(m.slices) as group}
							<div>
								<p class="mb-2 text-xs font-semibold text-primary">{phaseLabel(group.phase)}</p>
								<ul class="space-y-2">
									{#each group.slices as sl}
										<li class="rounded-lg border border-border bg-secondary/10 p-3 text-xs leading-relaxed text-foreground">
											<p class="font-medium">{sl.title}</p>
											{#if sl.notes?.trim()}
												<p class="mt-1 text-muted-foreground">{sl.notes}</p>
											{/if}
											{#if sl.estimate?.trim()}
												<p class="mt-1">
													<span class="text-muted-foreground">Estimate:</span>
													{sl.estimate}
												</p>
											{/if}
											{#if sl.owner_user_id}
												<p class="mt-1">
													<span class="text-muted-foreground">Owner:</span>
													{orgUserName(sl.owner_user_id) || '—'}
												</p>
											{/if}
											<p class="mt-1">
												<span class="text-muted-foreground">Status:</span>
												{sliceStatusLabel(normalizeSliceStatus(sl.status))}
											</p>
											{#if sl.depends_on?.trim()}
												<p class="mt-1">
													<span class="text-muted-foreground">Dependency:</span>
													{sl.depends_on}
												</p>
											{/if}
										</li>
									{/each}
								</ul>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if m.attach_bill && m.bill_amount != null}
				<div>
					<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bill</p>
					<p class="rounded-lg border border-border bg-secondary/10 p-3 text-sm text-foreground">
						{fmt(Number(m.bill_amount))}
						{#if m.bill_status}
							<span class="text-muted-foreground"> · </span>
							<StatusBadge status={m.bill_status} size="sm" />
						{/if}
					</p>
				</div>
			{/if}
		</div>
	{:else if msPreviewData && msPreviewData.kind === 'draft'}
		{@const d = msPreviewData}
		<div class="max-h-[min(80vh,40rem)] space-y-5 overflow-y-auto pr-1 text-sm">
			<div>
				<h3 class="text-lg font-semibold text-foreground">
					{d.title.trim() || 'Untitled milestone'}
				</h3>
				<p class="mt-1 text-xs text-muted-foreground">Draft preview — fields not yet saved.</p>
				<div class="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
					<StatusBadge status={d.phase} size="sm" />
					<StatusBadge status={d.priority} size="sm" />
					{#if d.dueDate}
						<span>Due {fmtDate(d.dueDate)}</span>
					{/if}
					{#if d.estimate}
						<span>&middot; Est. {d.estimate}</span>
					{/if}
					{#if d.ownerUserId}
						<span>&middot; Owner {orgUserName(d.ownerUserId) || '—'}</span>
					{/if}
				</div>
			</div>

			<div>
				<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overview</p>
				<div class="rounded-lg border border-border bg-background/50 p-3">
					{#if d.description?.trim()}
						<Markdown content={d.description} />
					{:else}
						<p class="text-sm text-muted-foreground">No description yet.</p>
					{/if}
				</div>
			</div>

			<div>
				<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lifecycle</p>
				<dl class="space-y-2 rounded-lg border border-border bg-secondary/10 p-3 text-sm">
					<div>
						<dt class="text-xs font-medium text-muted-foreground">Current phase</dt>
						<dd class="mt-0.5 text-foreground">{phaseLabel(d.phase)}</dd>
					</div>
					<div>
						<dt class="text-xs font-medium text-muted-foreground">Entry gate</dt>
						<dd class="mt-0.5 whitespace-pre-wrap text-foreground">{d.entryGate.trim() || '—'}</dd>
					</div>
					<div>
						<dt class="text-xs font-medium text-muted-foreground">Exit / completion gate</dt>
						<dd class="mt-0.5 whitespace-pre-wrap text-foreground">{d.exitGate.trim() || '—'}</dd>
					</div>
					<div>
						<dt class="text-xs font-medium text-muted-foreground">Approval owner</dt>
						<dd class="mt-0.5 text-foreground">
							{orgUserName(d.approvalOwnerUserId) || '—'}
						</dd>
					</div>
				</dl>
			</div>

			<div>
				<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quality</p>
				<dl class="space-y-2 rounded-lg border border-border bg-secondary/10 p-3 text-sm">
					<div>
						<dt class="text-xs font-medium text-muted-foreground">Required tests</dt>
						<dd class="mt-0.5 whitespace-pre-wrap text-foreground">{d.testRequired.trim() || '—'}</dd>
					</div>
					<div>
						<dt class="text-xs font-medium text-muted-foreground">Pass threshold</dt>
						<dd class="mt-0.5 text-foreground">{d.testPass.trim() || '—'}</dd>
					</div>
					<div>
						<dt class="text-xs font-medium text-muted-foreground">Environment tested on</dt>
						<dd class="mt-0.5 text-foreground">{d.testEnv.trim() || '—'}</dd>
					</div>
					{#if d.risks.trim()}
						<div>
							<dt class="text-xs font-medium text-muted-foreground">Risks / blockers</dt>
							<dd class="mt-0.5 whitespace-pre-wrap text-foreground">{d.risks}</dd>
						</div>
					{/if}
					{#if d.dependencies.trim()}
						<div>
							<dt class="text-xs font-medium text-muted-foreground">Dependencies</dt>
							<dd class="mt-0.5 whitespace-pre-wrap text-foreground">{d.dependencies}</dd>
						</div>
					{/if}
					{#if d.deliverables.trim()}
						<div>
							<dt class="text-xs font-medium text-muted-foreground">Deliverables</dt>
							<dd class="mt-0.5 whitespace-pre-wrap text-foreground">{d.deliverables}</dd>
						</div>
					{/if}
				</dl>
			</div>

			{#if groupDraftSlicesByPhase(d.slices, (s) => !!s.title.trim()).length > 0}
				<div>
					<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Slices by phase
					</p>
					<div class="space-y-4">
						{#each groupDraftSlicesByPhase(d.slices, (s) => !!s.title.trim()) as group}
							<div>
								<p class="mb-2 text-xs font-semibold text-primary">{phaseLabel(group.phase)}</p>
								<ul class="space-y-2">
									{#each group.slices as sl}
										<li class="rounded-lg border border-border bg-secondary/10 p-3 text-xs leading-relaxed text-foreground">
											<p class="font-medium">{sl.title}</p>
											{#if sl.notes?.trim()}
												<p class="mt-1 text-muted-foreground">{sl.notes}</p>
											{/if}
											{#if sl.estimate?.trim()}
												<p class="mt-1">
													<span class="text-muted-foreground">Estimate:</span>
													{sl.estimate}
												</p>
											{/if}
											{#if sl.owner_user_id}
												<p class="mt-1">
													<span class="text-muted-foreground">Owner:</span>
													{orgUserName(sl.owner_user_id) || '—'}
												</p>
											{/if}
											<p class="mt-1">
												<span class="text-muted-foreground">Status:</span>
												{sliceStatusLabel(sl.status)}
											</p>
											{#if sl.depends_on?.trim()}
												<p class="mt-1">
													<span class="text-muted-foreground">Dependency:</span>
													{sl.depends_on}
												</p>
											{/if}
										</li>
									{/each}
								</ul>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}
	<div class="mt-4 flex justify-end border-t border-border pt-4">
		<button
			type="button"
			onclick={() => (msPreviewOpen = false)}
			class="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/80"
		>
			Close
		</button>
	</div>
</Modal>

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

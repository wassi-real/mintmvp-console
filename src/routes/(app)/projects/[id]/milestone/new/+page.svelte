<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import Markdown from '$lib/components/Markdown.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { enhance } from '$app/forms';
	import { page } from '$app/stores';
	import { Eye, ArrowLeft } from 'lucide-svelte';
	import { groupDraftSlicesByPhase, normalizeSlicePhaseValue } from '$lib/milestone-shared';

	let { data } = $props();

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

	let msCreateSlices = $state<SliceRow[]>([emptySlice()]);
	let msCreateTitle = $state('');
	let msCreateDescription = $state('');
	let msCreatePhase = $state('discovery');
	let msCreatePriority = $state('p3_normal');
	let msCreateEstimate = $state('');
	let msCreateDueDate = $state('');
	let msCreateOwnerUserId = $state('');
	let msCreateSpecId = $state('');
	let msCreateEntryGate = $state('');
	let msCreateExitGate = $state('');
	let msCreateApprovalOwnerId = $state('');
	let msCreateTestRequired = $state('');
	let msCreateTestPass = $state('');
	let msCreateTestEnv = $state('');
	let msCreateRisks = $state('');
	let msCreateDeps = $state('');
	let msCreateDeliverables = $state('');
	let msCreateNotes = $state('');
	let msCreateAmount = $state('0');
	let msCreateMilestoneStatus = $state('planned');
	let msCreatePaidDate = $state('');
	let msCreateBillAmount = $state('');
	let msCreateBillStatus = $state('draft');
	let msCreateAttachBill = $state<'yes' | 'no'>('no');

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

	type MsPreviewData = {
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

	function orgUserName(id: string | null | undefined) {
		if (!id) return '';
		return data.orgUsers.find((u) => u.id === id)?.full_name ?? '';
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
	): MsPreviewData {
		return { kind: 'draft', title, description, slices, ...fields };
	}

	function fmtDate(d: string | null) {
		if (!d) return '--';
		return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}
</script>

<div class="mx-auto w-full max-w-4xl">
	<div class="mb-6">
		<a
			href="/projects/{$page.params.id}/milestone"
			class="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
		>
			<ArrowLeft size={16} />
			Back to milestones
		</a>
		<PageHeader title="New milestone" description="Define lifecycle, quality gates, slices, and optional finance." />
	</div>

	<form
		method="POST"
		action="?/createMilestone"
		use:enhance={() => {
			return async ({ update }) => {
				await update();
			};
		}}
		class="flex w-full flex-col rounded-xl border border-border bg-card p-4 sm:p-6"
	>
	<input type="hidden" name="slices_json" value={slicesJsonPayload(msCreateSlices)} />
	<div class="space-y-6 overflow-y-auto pr-1">
		<div>
			<p class="mb-3 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				Section 1 · Overview
			</p>
			<div class="space-y-4">
				<div>
					<label for="ms-n-title" class="mb-1 block text-sm font-medium text-foreground">Title *</label>
					<input
						id="ms-n-title"
						name="title"
						required
						bind:value={msCreateTitle}
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
					/>
				</div>
				<div>
					<div class="mb-1 flex flex-wrap items-center justify-between gap-2">
						<label for="ms-n-desc" class="block text-sm font-medium text-foreground">Description *</label>
						<button
							type="button"
							onclick={() => {
								msPreviewData = buildDraftPreview(
									msCreateTitle,
									msCreateDescription,
									msCreateSlices.map((s) => ({ ...s })),
									{
										phase: msCreatePhase,
										priority: msCreatePriority,
										estimate: msCreateEstimate,
										dueDate: msCreateDueDate,
										ownerUserId: msCreateOwnerUserId,
										entryGate: msCreateEntryGate,
										exitGate: msCreateExitGate,
										approvalOwnerUserId: msCreateApprovalOwnerId,
										testRequired: msCreateTestRequired,
										testPass: msCreateTestPass,
										testEnv: msCreateTestEnv,
										risks: msCreateRisks,
										dependencies: msCreateDeps,
										deliverables: msCreateDeliverables
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
						id="ms-n-desc"
						name="description"
						rows="6"
						required
						bind:value={msCreateDescription}
						placeholder="What this milestone is supposed to accomplish&#10;&#10;Example:&#10;- Goal one&#10;- **Bold** emphasis"
						class="min-h-[8rem] w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground"
					></textarea>
				</div>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<label for="ms-n-priority" class="mb-1 block text-sm font-medium text-foreground"
							>Priority *</label
						>
						<select
							id="ms-n-priority"
							name="priority"
							bind:value={msCreatePriority}
							class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
						>
							{#each PRIORITY_OPTIONS as p}
								<option value={p.value}>{p.label}</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="ms-n-owner" class="mb-1 block text-sm font-medium text-foreground">Owner</label>
						<select
							id="ms-n-owner"
							name="owner_user_id"
							bind:value={msCreateOwnerUserId}
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
						<label for="ms-n-est" class="mb-1 block text-sm font-medium text-foreground"
							>Estimate *</label
						>
						<input
							id="ms-n-est"
							name="estimate"
							required
							bind:value={msCreateEstimate}
							placeholder="e.g. 2 days, 12 hours, 1 week"
							class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
						/>
					</div>
					<div>
						<label for="ms-n-due" class="mb-1 block text-sm font-medium text-foreground"
							>Due date *</label
						>
						<input
							id="ms-n-due"
							name="due_date"
							type="date"
							required
							bind:value={msCreateDueDate}
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
					<label for="ms-n-phase" class="mb-1 block text-sm font-medium text-foreground"
						>Current phase *</label
					>
					<p class="mb-1.5 text-xs text-muted-foreground">
						Milestone stage (broader than individual task status).
					</p>
					<select
						id="ms-n-phase"
						name="phase"
						bind:value={msCreatePhase}
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
					>
						{#each PHASE_OPTIONS as p}
							<option value={p.value}>{p.label}</option>
						{/each}
					</select>
				</div>
				<div>
					<label for="ms-n-entry" class="mb-1 block text-sm font-medium text-foreground"
						>Entry gate *</label
					>
					<p class="mb-1.5 text-xs text-muted-foreground">What must be true before this milestone starts.</p>
					<textarea
						id="ms-n-entry"
						name="entry_gate"
						rows="3"
						required
						bind:value={msCreateEntryGate}
						placeholder="e.g. Repo access granted&#10;Requirements approved&#10;Previous milestone complete"
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
					></textarea>
				</div>
				<div>
					<label for="ms-n-exit" class="mb-1 block text-sm font-medium text-foreground"
						>Exit / completion gate *</label
					>
					<p class="mb-1.5 text-xs text-muted-foreground">What must be true before this milestone is marked complete.</p>
					<textarea
						id="ms-n-exit"
						name="exit_gate"
						rows="3"
						required
						bind:value={msCreateExitGate}
						placeholder="e.g. All slices complete&#10;Tests passed&#10;Client approved"
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
					></textarea>
				</div>
				<div>
					<label for="ms-n-approval-owner" class="mb-1 block text-sm font-medium text-foreground"
						>Approval owner *</label
					>
					<select
						id="ms-n-approval-owner"
						name="approval_owner_user_id"
						required
						bind:value={msCreateApprovalOwnerId}
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
							<label for="ms-n-treq" class="mb-1 block text-xs font-medium text-muted-foreground"
								>Required tests</label
							>
							<textarea
								id="ms-n-treq"
								name="test_gate_required_tests"
								rows="2"
								required
								bind:value={msCreateTestRequired}
								placeholder="e.g. Full regression suite, API contract tests, smoke on staging"
								class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
							></textarea>
						</div>
						<div>
							<label for="ms-n-tpass" class="mb-1 block text-xs font-medium text-muted-foreground"
								>Pass threshold</label
							>
							<input
								id="ms-n-tpass"
								name="test_gate_pass_threshold"
								required
								bind:value={msCreateTestPass}
								placeholder="e.g. 6/6 regression tests pass; no P1 bugs open"
								class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
							/>
						</div>
						<div>
							<label for="ms-n-tenv" class="mb-1 block text-xs font-medium text-muted-foreground"
								>Environment tested on</label
							>
							<input
								id="ms-n-tenv"
								name="test_gate_environment"
								required
								bind:value={msCreateTestEnv}
								placeholder="e.g. Staging — deploy abc123; staging health green"
								class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
							/>
						</div>
					</div>
				</div>
				<div>
					<label for="ms-n-risks" class="mb-1 block text-sm font-medium text-foreground"
						>Risks / blockers</label
					>
					<textarea
						id="ms-n-risks"
						name="risks_blockers"
						rows="2"
						bind:value={msCreateRisks}
						placeholder="Known things that may stop this milestone"
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
					></textarea>
				</div>
				<div>
					<label for="ms-n-deps" class="mb-1 block text-sm font-medium text-foreground">Dependencies</label>
					<textarea
						id="ms-n-deps"
						name="dependencies"
						rows="2"
						bind:value={msCreateDeps}
						placeholder="What must happen first (environments, keys, other milestones…)"
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
					></textarea>
				</div>
				<div>
					<label for="ms-n-deliverables" class="mb-1 block text-sm font-medium text-foreground"
						>Deliverables</label
					>
					<textarea
						id="ms-n-deliverables"
						name="deliverables"
						rows="2"
						bind:value={msCreateDeliverables}
						placeholder="Tangible outputs expected (docs, reports, PRs, test count…)"
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
				Assign each slice to a lifecycle phase. New slices default to the milestone’s current phase below — change per slice as needed.
			</p>
			<div class="space-y-3">
				{#each msCreateSlices as row, i (i)}
					<div class="space-y-3 rounded-lg border border-border bg-secondary/20 p-3">
						<div class="flex items-center justify-between gap-2">
							<span class="text-xs font-medium text-muted-foreground">Slice {i + 1}</span>
							<button
								type="button"
								onclick={() => {
									msCreateSlices = msCreateSlices.filter((_, j) => j !== i);
									if (msCreateSlices.length === 0) msCreateSlices = [emptySlice(msCreatePhase)];
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
							<label class="mb-1 block text-xs font-medium text-muted-foreground" for="ms-n-slice-phase-{i}"
								>Phase</label
							>
							<select
								id="ms-n-slice-phase-{i}"
								bind:value={row.phase}
								class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
							>
								{#each PHASE_OPTIONS as p}
									<option value={p.value}>{p.label}</option>
								{/each}
							</select>
						</div>
						<div>
							<label class="mb-1 block text-xs font-medium text-muted-foreground" for="ms-n-slice-notes-{i}"
								>Notes</label
							>
							<textarea
								id="ms-n-slice-notes-{i}"
								bind:value={row.notes}
								rows="2"
								placeholder="Context, acceptance hints, or investigation notes"
								class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
							></textarea>
						</div>
						<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<div>
								<label class="mb-1 block text-xs font-medium text-muted-foreground" for="ms-n-slice-owner-{i}"
									>Owner</label
								>
								<select
									id="ms-n-slice-owner-{i}"
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
								<label class="mb-1 block text-xs font-medium text-muted-foreground" for="ms-n-slice-est-{i}"
									>Estimate</label
								>
								<input
									id="ms-n-slice-est-{i}"
									bind:value={row.estimate}
									placeholder="e.g. 2h"
									class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
								/>
							</div>
							<div>
								<label class="mb-1 block text-xs font-medium text-muted-foreground" for="ms-n-slice-st-{i}"
									>Status</label
								>
								<select
									id="ms-n-slice-st-{i}"
									bind:value={row.status}
									class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
								>
									{#each SLICE_STATUS_OPTIONS as s}
										<option value={s.value}>{s.label}</option>
									{/each}
								</select>
							</div>
							<div>
								<label class="mb-1 block text-xs font-medium text-muted-foreground" for="ms-n-slice-dep-{i}"
									>Dependency (optional)</label
								>
								<input
									id="ms-n-slice-dep-{i}"
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
					msCreateSlices = [...msCreateSlices, emptySlice(msCreatePhase)];
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
					<label for="ms-n-spec" class="mb-1 block text-sm font-medium text-foreground">Linked spec</label>
					<select
						id="ms-n-spec"
						name="spec_id"
						bind:value={msCreateSpecId}
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
						<div class="max-h-36 space-y-2 overflow-y-auto rounded-lg border border-border bg-background p-3">
							{#each data.tasks as t}
								<label class="flex cursor-pointer items-center gap-2 text-sm text-foreground">
									<input type="checkbox" name="linked_task_id" value={t.id} class="rounded border-border" />
									<span class="truncate">{t.title}</span>
								</label>
							{/each}
						</div>
					</div>
				{/if}
				<div>
					<label for="ms-n-notes" class="mb-1 block text-sm font-medium text-foreground">Notes</label>
					<textarea
						id="ms-n-notes"
						name="notes"
						rows="2"
						bind:value={msCreateNotes}
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
					<label for="ms-n-amount" class="mb-1 block text-sm font-medium text-foreground"
						>Budget amount ($)</label
					>
					<input
						id="ms-n-amount"
						name="amount"
						type="number"
						step="0.01"
						min="0"
						bind:value={msCreateAmount}
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
					/>
				</div>
				<div>
					<label for="ms-n-status" class="mb-1 block text-sm font-medium text-foreground"
						>Payment status</label
					>
					<select
						id="ms-n-status"
						name="status"
						bind:value={msCreateMilestoneStatus}
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
					>
						{#each MILESTONE_STATUSES as s}
							<option value={s}>{s.replace(/_/g, ' ')}</option>
						{/each}
					</select>
				</div>
			</div>
			<div class="mt-3">
				<label for="ms-n-paid" class="mb-1 block text-sm font-medium text-foreground">Paid date</label>
				<input
					id="ms-n-paid"
					name="paid_date"
					type="date"
					bind:value={msCreatePaidDate}
					class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground sm:max-w-xs"
				/>
			</div>
			<div class="mt-4 border-t border-border pt-4">
				<label for="ms-n-attach-bill" class="mb-1 block text-sm font-medium text-foreground"
					>Attach bill</label
				>
				<select
					id="ms-n-attach-bill"
					name="attach_bill"
					bind:value={msCreateAttachBill}
					class="w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
				>
					<option value="no">No</option>
					<option value="yes">Yes</option>
				</select>
				{#if msCreateAttachBill === 'yes'}
					<div class="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div>
							<label for="ms-n-bill-amt" class="mb-1 block text-sm font-medium text-foreground"
								>Bill amount ($) *</label
							>
							<input
								id="ms-n-bill-amt"
								name="bill_amount"
								type="number"
								step="0.01"
								min="0"
								required
								bind:value={msCreateBillAmount}
								class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
							/>
						</div>
						<div>
							<label for="ms-n-bill-st" class="mb-1 block text-sm font-medium text-foreground"
								>Bill status *</label
							>
							<select
								id="ms-n-bill-st"
								name="bill_status"
								required
								bind:value={msCreateBillStatus}
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
	<div class="mt-6 flex shrink-0 justify-center border-t border-border pt-4">
		<button
			type="submit"
			class="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
		>
			Create milestone
		</button>
	</div>
</form>
</div>

<Modal bind:open={msPreviewOpen} title="Milestone preview">
	{#if msPreviewData && msPreviewData.kind === 'draft'}
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

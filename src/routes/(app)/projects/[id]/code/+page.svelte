<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { GitCommitHorizontal, GitBranch, Plus, Loader, Pencil, Trash2 } from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	function timeAgo(dateStr: string | null): string {
		if (!dateStr) return 'Never';
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.floor(hours / 24)}d ago`;
	}

	let activeTab = $state<'commits' | 'branches'>('commits');

	// Commit modals
	let commitCreateOpen = $state(false);
	let commitCreateSubmitting = $state(false);
	let commitCreateError = $state('');

	let commitEditOpen = $state(false);
	let commitEditItem = $state<any>(null);
	let commitEditSubmitting = $state(false);
	let commitEditError = $state('');
	function openEditCommit(c: any) { commitEditItem = { ...c }; commitEditError = ''; commitEditOpen = true; }

	let commitDeleteOpen = $state(false);
	let commitDeleteItem = $state<any>(null);
	let commitDeleteSubmitting = $state(false);
	function openDeleteCommit(c: any) { commitDeleteItem = c; commitDeleteOpen = true; }

	// Branch modals
	let branchCreateOpen = $state(false);
	let branchCreateSubmitting = $state(false);
	let branchCreateError = $state('');

	let branchEditOpen = $state(false);
	let branchEditItem = $state<any>(null);
	let branchEditSubmitting = $state(false);
	let branchEditError = $state('');
	function openEditBranch(b: any) { branchEditItem = { ...b }; branchEditError = ''; branchEditOpen = true; }

	let branchDeleteOpen = $state(false);
	let branchDeleteItem = $state<any>(null);
	let branchDeleteSubmitting = $state(false);
	function openDeleteBranch(b: any) { branchDeleteItem = b; branchDeleteOpen = true; }

	function taskName(taskId: string | null) {
		if (!taskId) return '--';
		const t = data.tasks.find((t: any) => t.id === taskId);
		return t?.title ?? taskId.slice(0, 8);
	}
</script>

<div>
	<PageHeader title="Codebase" description="Manual commits & branch tracking">
		{#snippet actions()}
			{#if activeTab === 'commits'}
				<button onclick={() => { commitCreateError = ''; commitCreateOpen = true; }}
					class="flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90">
					<Plus size={20} /> Add Commit
				</button>
			{:else}
				<button onclick={() => { branchCreateError = ''; branchCreateOpen = true; }}
					class="flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90">
					<Plus size={20} /> Add Branch
				</button>
			{/if}
		{/snippet}
	</PageHeader>

	<!-- Tabs -->
	<div class="mt-4 flex gap-2 border-b border-border">
		<button onclick={() => (activeTab = 'commits')}
			class="flex items-center gap-2 border-b-2 px-4 py-3 text-base font-medium transition-colors {activeTab === 'commits' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}">
			<GitCommitHorizontal size={18} /> Commits ({data.commits.length})
		</button>
		<button onclick={() => (activeTab = 'branches')}
			class="flex items-center gap-2 border-b-2 px-4 py-3 text-base font-medium transition-colors {activeTab === 'branches' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}">
			<GitBranch size={18} /> Branches ({data.branches.length})
		</button>
	</div>

	{#if activeTab === 'commits'}
		{#if data.commits.length === 0}
			<EmptyState icon={GitCommitHorizontal} title="No commits yet" description="Track code changes manually." />
		{:else}
			<!-- Mobile card view -->
			<div class="mt-6 space-y-3 sm:hidden">
				{#each data.commits as c}
					<div class="rounded-xl border border-border bg-card p-4">
						<div class="flex items-start justify-between gap-2">
							<div class="min-w-0 flex-1">
								<p class="text-base font-semibold text-foreground">{c.commit_message}</p>
								<code class="mt-1 inline-block rounded bg-secondary px-2 py-0.5 text-xs font-mono text-foreground">{c.branch_name}</code>
							</div>
							<div class="flex shrink-0 items-center gap-1">
								<button onclick={() => openEditCommit(c)} class="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Edit"><Pencil size={14} /></button>
								<button onclick={() => openDeleteCommit(c)} class="rounded p-1.5 text-muted-foreground hover:bg-red-900/40 hover:text-red-300" aria-label="Delete"><Trash2 size={14} /></button>
							</div>
						</div>
						<div class="mt-3 flex flex-wrap items-center gap-2 text-sm">
							<StatusBadge status={c.status} size="sm" />
							{#if c.developer_name}<span class="text-muted-foreground">{c.developer_name}</span>{/if}
							<span class="text-muted-foreground">{timeAgo(c.created_at)}</span>
						</div>
					</div>
				{/each}
			</div>
			<!-- Desktop table view -->
			<div class="mt-6 hidden overflow-x-auto rounded-xl border border-border sm:block">
				<table class="w-full text-left">
					<thead class="border-b border-border bg-secondary/50">
						<tr>
							<th class="px-5 py-3 text-sm font-semibold text-foreground">Message</th>
							<th class="px-5 py-3 text-sm font-semibold text-foreground">Branch</th>
							<th class="hidden px-5 py-3 text-sm font-semibold text-foreground md:table-cell">Developer</th>
							<th class="px-5 py-3 text-sm font-semibold text-foreground">Status</th>
							<th class="hidden px-5 py-3 text-sm font-semibold text-foreground lg:table-cell">Linked Task</th>
							<th class="px-5 py-3 text-sm font-semibold text-foreground">When</th>
							<th class="px-5 py-3"></th>
						</tr>
					</thead>
					<tbody>
						{#each data.commits as c}
							<tr class="group border-b border-border transition-colors hover:bg-secondary/30">
								<td class="max-w-[280px] truncate px-5 py-3 text-base font-semibold text-foreground">{c.commit_message}</td>
								<td class="px-5 py-3"><code class="rounded bg-secondary px-2 py-0.5 text-xs font-mono text-foreground">{c.branch_name}</code></td>
								<td class="hidden px-5 py-3 text-sm text-muted-foreground md:table-cell">{c.developer_name || '--'}</td>
								<td class="px-5 py-3"><StatusBadge status={c.status} size="sm" /></td>
								<td class="hidden px-5 py-3 text-sm text-muted-foreground lg:table-cell">{taskName(c.task_id)}</td>
								<td class="px-5 py-3 text-sm text-muted-foreground">{timeAgo(c.created_at)}</td>
								<td class="px-5 py-3">
									<div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
										<button onclick={() => openEditCommit(c)} class="rounded p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Edit"><Pencil size={16} /></button>
										<button onclick={() => openDeleteCommit(c)} class="rounded p-2 text-muted-foreground hover:bg-red-900/40 hover:text-red-300" aria-label="Delete"><Trash2 size={16} /></button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{:else}
		{#if data.branches.length === 0}
			<EmptyState icon={GitBranch} title="No branches yet" description="Add your project branches." />
		{:else}
			<div class="mt-6 overflow-hidden rounded-xl border border-border">
				<table class="w-full text-left">
					<thead class="border-b border-border bg-secondary/50">
						<tr>
							<th class="px-6 py-4 text-base font-semibold text-foreground">Branch</th>
							<th class="px-6 py-4 text-base font-semibold text-foreground">Status</th>
							<th class="px-6 py-4 text-base font-semibold text-foreground">Last Activity</th>
							<th class="px-6 py-4"></th>
						</tr>
					</thead>
					<tbody>
						{#each data.branches as b}
							<tr class="group border-b border-border transition-colors hover:bg-secondary/30">
								<td class="px-6 py-4"><code class="rounded bg-secondary px-2 py-1 text-base font-mono font-semibold text-foreground">{b.name}</code></td>
								<td class="px-6 py-4"><StatusBadge status={b.status} /></td>
								<td class="px-6 py-4 text-base text-muted-foreground">{timeAgo(b.last_activity_at)}</td>
								<td class="px-6 py-4">
									<div class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
										<button onclick={() => openEditBranch(b)} class="rounded p-2 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Edit"><Pencil size={16} /></button>
										<button onclick={() => openDeleteBranch(b)} class="rounded p-2 text-muted-foreground hover:bg-red-900/40 hover:text-red-300" aria-label="Delete"><Trash2 size={16} /></button>
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}
</div>

<!-- ─── Commit Create Modal ────────────────────────── -->
<Modal bind:open={commitCreateOpen} title="Add Commit">
	<form method="POST" action="?/createCommit" use:enhance={() => { commitCreateSubmitting = true; commitCreateError = '';
		return async ({ result }) => { commitCreateSubmitting = false;
			if (result.type === 'failure') commitCreateError = (result.data as any)?.error ?? 'Error';
			else { commitCreateOpen = false; await invalidateAll(); }
		};
	}}>
		{#if commitCreateError}<div class="mb-4 rounded-lg bg-red-900/30 px-4 py-3 text-base text-red-300">{commitCreateError}</div>{/if}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<div class="sm:col-span-2">
				<label for="cc-msg" class="mb-1 block text-base font-medium text-foreground">Commit Message <span class="text-destructive">*</span></label>
				<input id="cc-msg" name="commit_message" required class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground" placeholder="Fix timing overlap bug" />
			</div>
			<div>
				<label for="cc-branch" class="mb-1 block text-base font-medium text-foreground">Branch <span class="text-destructive">*</span></label>
				<input id="cc-branch" name="branch_name" required class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground" placeholder="feature/flow-fix" />
			</div>
			<div>
				<label for="cc-dev" class="mb-1 block text-base font-medium text-foreground">Developer</label>
				<input id="cc-dev" name="developer_name" class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground" placeholder="Name" />
			</div>
			<div>
				<label for="cc-status" class="mb-1 block text-base font-medium text-foreground">Status</label>
				<select id="cc-status" name="status" class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground">
					<option value="draft" selected>Draft</option><option value="in_review">In Review</option><option value="merged">Merged</option>
				</select>
			</div>
			<div>
				<label for="cc-task" class="mb-1 block text-base font-medium text-foreground">Linked Task</label>
				<select id="cc-task" name="task_id" class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground">
					<option value="">None</option>
					{#each data.tasks as t}<option value={t.id}>{t.title}</option>{/each}
				</select>
			</div>
		</div>
		<div class="mt-6 flex gap-3">
			<button type="submit" disabled={commitCreateSubmitting} class="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
				{#if commitCreateSubmitting}<Loader size={18} class="animate-spin" />Adding...{:else}Add Commit{/if}
			</button>
			<button type="button" onclick={() => (commitCreateOpen = false)} class="rounded-lg bg-secondary px-6 py-3 text-base font-medium text-foreground hover:bg-accent">Cancel</button>
		</div>
	</form>
</Modal>

<!-- ─── Commit Edit Modal ──────────────────────────── -->
<Modal bind:open={commitEditOpen} title="Edit Commit">
	{#if commitEditItem}
		<form method="POST" action="?/updateCommit" use:enhance={() => { commitEditSubmitting = true; commitEditError = '';
			return async ({ result }) => { commitEditSubmitting = false;
				if (result.type === 'failure') commitEditError = (result.data as any)?.error ?? 'Error';
				else { commitEditOpen = false; await invalidateAll(); }
			};
		}}>
			{#if commitEditError}<div class="mb-4 rounded-lg bg-red-900/30 px-4 py-3 text-base text-red-300">{commitEditError}</div>{/if}
			<input type="hidden" name="id" value={commitEditItem.id} />
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div class="sm:col-span-2">
					<label for="ce-msg" class="mb-1 block text-base font-medium text-foreground">Commit Message <span class="text-destructive">*</span></label>
					<input id="ce-msg" name="commit_message" required bind:value={commitEditItem.commit_message} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground" />
				</div>
				<div>
					<label for="ce-branch" class="mb-1 block text-base font-medium text-foreground">Branch <span class="text-destructive">*</span></label>
					<input id="ce-branch" name="branch_name" required bind:value={commitEditItem.branch_name} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground" />
				</div>
				<div>
					<label for="ce-dev" class="mb-1 block text-base font-medium text-foreground">Developer</label>
					<input id="ce-dev" name="developer_name" bind:value={commitEditItem.developer_name} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground" />
				</div>
				<div>
					<label for="ce-status" class="mb-1 block text-base font-medium text-foreground">Status</label>
					<select id="ce-status" name="status" bind:value={commitEditItem.status} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground">
						<option value="draft">Draft</option><option value="in_review">In Review</option><option value="merged">Merged</option>
					</select>
				</div>
				<div>
					<label for="ce-task" class="mb-1 block text-base font-medium text-foreground">Linked Task</label>
					<select id="ce-task" name="task_id" bind:value={commitEditItem.task_id} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground">
						<option value="">None</option>
						{#each data.tasks as t}<option value={t.id}>{t.title}</option>{/each}
					</select>
				</div>
			</div>
			<div class="mt-6 flex gap-3">
				<button type="submit" disabled={commitEditSubmitting} class="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
					{#if commitEditSubmitting}<Loader size={18} class="animate-spin" />Saving...{:else}Save Changes{/if}
				</button>
				<button type="button" onclick={() => (commitEditOpen = false)} class="rounded-lg bg-secondary px-6 py-3 text-base font-medium text-foreground hover:bg-accent">Cancel</button>
			</div>
		</form>
	{/if}
</Modal>

<!-- ─── Commit Delete Modal ────────────────────────── -->
<Modal bind:open={commitDeleteOpen} title="Delete Commit">
	{#if commitDeleteItem}
		<p class="text-lg text-foreground">Delete commit <strong>"{commitDeleteItem.commit_message}"</strong>?</p>
		<form method="POST" action="?/deleteCommit" use:enhance={() => { commitDeleteSubmitting = true;
			return async ({ result }) => { commitDeleteSubmitting = false;
				if (result.type !== 'failure') { commitDeleteOpen = false; await invalidateAll(); }
			};
		}}>
			<input type="hidden" name="id" value={commitDeleteItem.id} />
			<div class="mt-6 flex gap-3">
				<button type="submit" disabled={commitDeleteSubmitting} class="flex items-center gap-2 rounded-lg bg-destructive px-6 py-3 text-base font-semibold text-white hover:bg-destructive/90 disabled:opacity-60">
					{#if commitDeleteSubmitting}<Loader size={18} class="animate-spin" />Deleting...{:else}<Trash2 size={18} />Delete{/if}
				</button>
				<button type="button" onclick={() => (commitDeleteOpen = false)} class="rounded-lg bg-secondary px-6 py-3 text-base font-medium text-foreground hover:bg-accent">Cancel</button>
			</div>
		</form>
	{/if}
</Modal>

<!-- ─── Branch Create Modal ────────────────────────── -->
<Modal bind:open={branchCreateOpen} title="Add Branch">
	<form method="POST" action="?/createBranch" use:enhance={() => { branchCreateSubmitting = true; branchCreateError = '';
		return async ({ result }) => { branchCreateSubmitting = false;
			if (result.type === 'failure') branchCreateError = (result.data as any)?.error ?? 'Error';
			else { branchCreateOpen = false; await invalidateAll(); }
		};
	}}>
		{#if branchCreateError}<div class="mb-4 rounded-lg bg-red-900/30 px-4 py-3 text-base text-red-300">{branchCreateError}</div>{/if}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
			<div>
				<label for="cb-name" class="mb-1 block text-base font-medium text-foreground">Branch Name <span class="text-destructive">*</span></label>
				<input id="cb-name" name="name" required class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground" placeholder="feature/my-feature" />
			</div>
			<div>
				<label for="cb-status" class="mb-1 block text-base font-medium text-foreground">Status</label>
				<select id="cb-status" name="status" class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground">
					<option value="stable" selected>Stable</option><option value="testing">Testing</option><option value="broken">Broken</option>
				</select>
			</div>
		</div>
		<div class="mt-6 flex gap-3">
			<button type="submit" disabled={branchCreateSubmitting} class="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
				{#if branchCreateSubmitting}<Loader size={18} class="animate-spin" />Adding...{:else}Add Branch{/if}
			</button>
			<button type="button" onclick={() => (branchCreateOpen = false)} class="rounded-lg bg-secondary px-6 py-3 text-base font-medium text-foreground hover:bg-accent">Cancel</button>
		</div>
	</form>
</Modal>

<!-- ─── Branch Edit Modal ──────────────────────────── -->
<Modal bind:open={branchEditOpen} title="Edit Branch">
	{#if branchEditItem}
		<form method="POST" action="?/updateBranch" use:enhance={() => { branchEditSubmitting = true; branchEditError = '';
			return async ({ result }) => { branchEditSubmitting = false;
				if (result.type === 'failure') branchEditError = (result.data as any)?.error ?? 'Error';
				else { branchEditOpen = false; await invalidateAll(); }
			};
		}}>
			{#if branchEditError}<div class="mb-4 rounded-lg bg-red-900/30 px-4 py-3 text-base text-red-300">{branchEditError}</div>{/if}
			<input type="hidden" name="id" value={branchEditItem.id} />
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<div>
					<label for="be-name" class="mb-1 block text-base font-medium text-foreground">Branch Name <span class="text-destructive">*</span></label>
					<input id="be-name" name="name" required bind:value={branchEditItem.name} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground" />
				</div>
				<div>
					<label for="be-status" class="mb-1 block text-base font-medium text-foreground">Status</label>
					<select id="be-status" name="status" bind:value={branchEditItem.status} class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground">
						<option value="stable">Stable</option><option value="testing">Testing</option><option value="broken">Broken</option>
					</select>
				</div>
			</div>
			<div class="mt-6 flex gap-3">
				<button type="submit" disabled={branchEditSubmitting} class="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
					{#if branchEditSubmitting}<Loader size={18} class="animate-spin" />Saving...{:else}Save Changes{/if}
				</button>
				<button type="button" onclick={() => (branchEditOpen = false)} class="rounded-lg bg-secondary px-6 py-3 text-base font-medium text-foreground hover:bg-accent">Cancel</button>
			</div>
		</form>
	{/if}
</Modal>

<!-- ─── Branch Delete Modal ────────────────────────── -->
<Modal bind:open={branchDeleteOpen} title="Delete Branch">
	{#if branchDeleteItem}
		<p class="text-lg text-foreground">Delete branch <strong>{branchDeleteItem.name}</strong>?</p>
		<form method="POST" action="?/deleteBranch" use:enhance={() => { branchDeleteSubmitting = true;
			return async ({ result }) => { branchDeleteSubmitting = false;
				if (result.type !== 'failure') { branchDeleteOpen = false; await invalidateAll(); }
			};
		}}>
			<input type="hidden" name="id" value={branchDeleteItem.id} />
			<div class="mt-6 flex gap-3">
				<button type="submit" disabled={branchDeleteSubmitting} class="flex items-center gap-2 rounded-lg bg-destructive px-6 py-3 text-base font-semibold text-white hover:bg-destructive/90 disabled:opacity-60">
					{#if branchDeleteSubmitting}<Loader size={18} class="animate-spin" />Deleting...{:else}<Trash2 size={18} />Delete{/if}
				</button>
				<button type="button" onclick={() => (branchDeleteOpen = false)} class="rounded-lg bg-secondary px-6 py-3 text-base font-medium text-foreground hover:bg-accent">Cancel</button>
			</div>
		</form>
	{/if}
</Modal>

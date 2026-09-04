<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Modal from '$lib/components/Modal.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import PageTitleBar from '$lib/components/PageTitleBar.svelte';
	import {
		Save,
		Trash2,
		Loader,
		AlertTriangle,
		Globe,
		GitBranch,
		Rocket,
		Activity,
		CheckCircle,
		Github,
		ChevronRight
	} from 'lucide-svelte';

	let { data } = $props();

	// Editable copy — syncs from server data after each successful save
	let project = $state(untrack(() => ({ ...data.project })));
	$effect(() => {
		project = { ...data.project };
	});

	// Update form
	let updateSubmitting = $state(false);
	let updateError = $state('');
	let updateSuccess = $state(false);

	// Delete form
	let deleteConfirmInput = $state('');
	let deleteSubmitting = $state(false);
	let deleteError = $state('');
	let deleteOpen = $state(false);

	const confirmMatch = $derived(deleteConfirmInput === data.project.name);

	function resetEdit() {
		project = { ...data.project };
		updateError = '';
		updateSuccess = false;
	}

	const statusOptions = [
		{
			value: 'active',
			label: 'Active',
			description: 'In active development',
			dot: 'bg-success'
		},
		{
			value: 'maintenance',
			label: 'Maintenance',
			description: 'Bug fixes only',
			dot: 'bg-warning'
		},
		{
			value: 'paused',
			label: 'Paused',
			description: 'Temporarily on hold',
			dot: 'bg-muted-foreground'
		}
	];

	const labelClass =
		'mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground';
	const inputClass =
		'w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none';

	const createdLabel = $derived(
		new Date(data.project.created_at).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		})
	);
</script>

<PageTitleBar title="Settings">
	{#snippet meta()}
		<span class="truncate font-medium text-foreground">{data.project.name}</span>
		<span class="text-muted-foreground/40">·</span>
		<StatusBadge status={data.project.status} size="sm" />
	{/snippet}
</PageTitleBar>

<div class="mx-auto w-full max-w-3xl space-y-4 pb-4">
	<!-- ─── General ──────────────────────────────────── -->
	<section class="rise rounded-xl border border-border bg-card">
		<div class="border-b border-border/60 px-4 py-3 sm:px-5">
			<h2 class="text-sm font-semibold text-foreground">General</h2>
			<p class="mt-0.5 text-xs text-muted-foreground">Name, status, and environment URLs</p>
		</div>

		<form
			method="POST"
			action="?/update"
			use:enhance={() => {
				updateSubmitting = true;
				updateError = '';
				updateSuccess = false;
				return async ({ result }) => {
					updateSubmitting = false;
					if (result.type === 'failure') {
						updateError = (result.data as any)?.error ?? 'Something went wrong';
					} else {
						updateSuccess = true;
						await invalidateAll();
						setTimeout(() => (updateSuccess = false), 3000);
					}
				};
			}}
		>
			<div class="space-y-5 p-4 sm:p-5">
				{#if updateError}
					<div
						class="flex items-center gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
					>
						<AlertTriangle size={15} class="shrink-0" />
						{updateError}
					</div>
				{/if}
				{#if updateSuccess}
					<div
						class="flex items-center gap-2.5 rounded-lg border border-success/40 bg-success/10 px-3 py-2.5 text-sm text-success"
					>
						<CheckCircle size={15} class="shrink-0" />
						Project updated successfully
					</div>
				{/if}

				<!-- Name -->
				<div>
					<label for="s-name" class={labelClass}>
						Project name <span class="text-destructive">*</span>
					</label>
					<input
						id="s-name"
						name="name"
						required
						bind:value={project.name}
						class={inputClass}
						placeholder="My Project"
					/>
				</div>

				<!-- Status -->
				<fieldset>
					<legend class={labelClass}>Status</legend>
					<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
						{#each statusOptions as opt (opt.value)}
							<label
								class="press relative flex cursor-pointer flex-col rounded-lg border p-3 transition-colors {project.status ===
								opt.value
									? 'border-ring bg-secondary/60'
									: 'border-border bg-background hover:border-input'}"
							>
								<input
									type="radio"
									name="status"
									value={opt.value}
									bind:group={project.status}
									class="sr-only"
								/>
								<div class="flex items-center gap-2">
									<span class="h-2 w-2 shrink-0 rounded-full {opt.dot}"></span>
									<span class="text-sm font-semibold text-foreground">{opt.label}</span>
									{#if project.status === opt.value}
										<CheckCircle size={14} class="ml-auto text-foreground" />
									{/if}
								</div>
								<p class="mt-1 text-xs text-muted-foreground">{opt.description}</p>
							</label>
						{/each}
					</div>
				</fieldset>

				<div class="border-t border-border/60"></div>

				<!-- Repo URL -->
				<div>
					<label for="s-repo" class={labelClass}>
						<GitBranch size={13} /> Repository URL
					</label>
					<input
						id="s-repo"
						name="repo_url"
						type="url"
						bind:value={project.repo_url}
						class={inputClass}
						placeholder="https://github.com/org/repo"
					/>
				</div>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<!-- Staging URL -->
					<div>
						<label for="s-staging" class={labelClass}>
							<Globe size={13} /> Staging URL
						</label>
						<input
							id="s-staging"
							name="staging_url"
							type="url"
							bind:value={project.staging_url}
							class={inputClass}
							placeholder="https://staging.example.com"
						/>
					</div>

					<!-- Production URL -->
					<div>
						<label for="s-prod" class={labelClass}>
							<Rocket size={13} /> Production URL
						</label>
						<input
							id="s-prod"
							name="production_url"
							type="url"
							bind:value={project.production_url}
							class={inputClass}
							placeholder="https://example.com"
						/>
					</div>
				</div>
			</div>

			<div
				class="flex items-center justify-between gap-3 border-t border-border/60 px-4 py-3 sm:px-5"
			>
				<button
					type="button"
					onclick={resetEdit}
					class="press rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
				>
					Reset changes
				</button>
				<button
					type="submit"
					disabled={updateSubmitting}
					class="press flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
				>
					{#if updateSubmitting}
						<Loader size={15} class="animate-spin" /> Saving…
					{:else}
						<Save size={15} /> Save changes
					{/if}
				</button>
			</div>
		</form>
	</section>

	<!-- ─── Project info ─────────────────────────────── -->
	<section class="rise rounded-xl border border-border bg-card" style:--delay="40ms">
		<div class="border-b border-border/60 px-4 py-3 sm:px-5">
			<h2 class="text-sm font-semibold text-foreground">Project info</h2>
		</div>
		<dl class="divide-y divide-border/60">
			<div class="row-hover flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
				<dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
					Project ID
				</dt>
				<dd
					class="select-all truncate rounded bg-secondary px-2 py-0.5 font-mono text-xs tabular-nums text-foreground"
				>
					{data.project.id}
				</dd>
			</div>
			<div class="row-hover flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
				<dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Created</dt>
				<dd class="text-sm tabular-nums text-foreground">{createdLabel}</dd>
			</div>
			<div class="row-hover flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
				<dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
					Current status
				</dt>
				<dd><StatusBadge status={data.project.status} size="sm" /></dd>
			</div>
			<div class="row-hover flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
				<dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Activity</dt>
				<dd>
					<a
						href="/projects/{data.project.id}/activity"
						class="inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:underline"
					>
						<Activity size={14} /> Activity log
					</a>
				</dd>
			</div>
		</dl>
	</section>

	<!-- ─── Integrations ─────────────────────────────── -->
	<section class="rise rounded-xl border border-border bg-card" style:--delay="80ms">
		<div class="border-b border-border/60 px-4 py-3 sm:px-5">
			<h2 class="text-sm font-semibold text-foreground">Integrations</h2>
		</div>
		<a
			href="/projects/{data.project.id}/settings/github"
			class="row-hover flex items-center justify-between gap-3 px-4 py-3 sm:px-5"
		>
			<div class="flex min-w-0 items-center gap-3">
				<Github size={18} class="shrink-0 text-foreground" />
				<div class="min-w-0">
					<p class="text-sm font-semibold text-foreground">GitHub</p>
					<p class="truncate text-xs text-muted-foreground">
						Connect repo; sync branches, PRs, commits, and CI
					</p>
				</div>
			</div>
			<ChevronRight size={16} class="shrink-0 text-muted-foreground" />
		</a>
	</section>

	<!-- ─── Danger zone ──────────────────────────────── -->
	<section
		class="rise rounded-xl border border-destructive/40 bg-destructive/5"
		style:--delay="120ms"
	>
		<div class="border-b border-destructive/30 px-4 py-3 sm:px-5">
			<h2 class="text-sm font-semibold text-destructive">Danger zone</h2>
		</div>
		<div class="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:p-5">
			<div class="min-w-0">
				<h3 class="text-sm font-semibold text-foreground">Delete this project</h3>
				<p class="mt-1 text-xs text-muted-foreground">
					Permanently deletes <strong class="font-semibold text-foreground"
						>{data.project.name}</strong
					> and all its data — specs, tasks, tests, incidents, reports, and activity. This action cannot
					be undone.
				</p>
			</div>
			<button
				type="button"
				onclick={() => {
					deleteOpen = true;
					deleteConfirmInput = '';
					deleteError = '';
				}}
				class="press flex shrink-0 items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/20"
			>
				<Trash2 size={15} /> Delete project
			</button>
		</div>
	</section>
</div>

<!-- ─── Delete confirm ───────────────────────────── -->
<Modal bind:open={deleteOpen} title="Delete Project">
	<form
		method="POST"
		action="?/delete"
		use:enhance={() => {
			deleteSubmitting = true;
			deleteError = '';
			return async ({ result }) => {
				deleteSubmitting = false;
				if (result.type === 'failure') {
					deleteError = (result.data as any)?.error ?? 'Something went wrong';
				}
				// On success, SvelteKit will follow the redirect
			};
		}}
		class="space-y-4"
	>
		<input type="hidden" name="project_name" value={data.project.name} />

		<div class="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4">
			<AlertTriangle size={20} class="mt-0.5 shrink-0 text-warning" />
			<p class="text-sm text-muted-foreground">
				<strong class="font-semibold text-foreground">This cannot be reversed.</strong> All specs,
				tasks, tests, incidents, reports, GitHub-linked sync data, environments, and activity will be
				permanently deleted.
			</p>
		</div>

		<div>
			<label
				for="delete-confirm"
				class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
			>
				Type <strong class="select-all font-mono normal-case text-destructive"
					>{data.project.name}</strong
				> to confirm
			</label>
			<input
				id="delete-confirm"
				name="confirm"
				autocomplete="off"
				bind:value={deleteConfirmInput}
				class="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-destructive focus:outline-none"
				placeholder="Type project name here…"
			/>
		</div>

		{#if deleteError}
			<div
				class="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
			>
				<AlertTriangle size={14} class="shrink-0" /> {deleteError}
			</div>
		{/if}

		<div class="flex justify-end gap-3 pt-2">
			<button
				type="button"
				onclick={() => (deleteOpen = false)}
				class="press rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
			>
				Cancel
			</button>
			<button
				type="submit"
				disabled={!confirmMatch || deleteSubmitting}
				class="press flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:cursor-not-allowed disabled:opacity-40"
			>
				{#if deleteSubmitting}
					<Loader size={15} class="animate-spin" /> Deleting…
				{:else}
					<Trash2 size={15} /> Delete project forever
				{/if}
			</button>
		</div>
	</form>
</Modal>

<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import {
		Settings2, Save, Trash2, Loader, AlertTriangle,
		Globe, GitBranch, Rocket, Activity, CheckCircle, Github, ChevronRight
	} from 'lucide-svelte';

	let { data } = $props();

	// Editable copy — syncs from server data after each successful save
	let project = $state({ ...data.project });
	$effect(() => { project = { ...data.project }; });

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
		{ value: 'active', label: 'Active', description: 'Project is in active development' },
		{ value: 'maintenance', label: 'Maintenance', description: 'Accepting bug fixes only' },
		{ value: 'paused', label: 'Paused', description: 'Work is temporarily on hold' }
	];
</script>

<div class="mx-auto max-w-2xl">
	<!-- Header -->
	<div class="mb-8 flex items-center gap-3">
		<Settings2 size={28} class="text-muted-foreground" />
		<div>
			<h1 class="text-2xl font-bold text-foreground">Project Settings</h1>
			<p class="text-sm text-muted-foreground">Manage details and configuration for <strong class="text-foreground">{data.project.name}</strong></p>
		</div>
	</div>

	<!-- ─── General Settings ─────────────────────────── -->
	<section>
		<h2 class="mb-4 text-lg font-semibold text-foreground">General</h2>
		<div class="rounded-xl border border-border bg-card">
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
				<div class="space-y-5 p-6">
					{#if updateError}
						<div class="flex items-center gap-3 rounded-lg bg-red-900/30 px-4 py-3 text-sm text-red-300">
							<AlertTriangle size={16} class="shrink-0" />
							{updateError}
						</div>
					{/if}
					{#if updateSuccess}
						<div class="flex items-center gap-3 rounded-lg bg-green-900/30 px-4 py-3 text-sm text-green-300">
							<CheckCircle size={16} class="shrink-0" />
							Project updated successfully
						</div>
					{/if}

					<!-- Name -->
					<div>
						<label for="s-name" class="mb-1.5 block text-sm font-semibold text-foreground">
							Project Name <span class="text-destructive">*</span>
						</label>
						<input
							id="s-name"
							name="name"
							required
							bind:value={project.name}
							class="w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground transition-colors focus:border-primary focus:outline-none"
							placeholder="My Project"
						/>
					</div>

					<!-- Status -->
					<fieldset>
						<legend class="mb-1.5 block text-sm font-semibold text-foreground">Status</legend>
						<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
							{#each statusOptions as opt}
								<label class="relative flex cursor-pointer flex-col rounded-lg border-2 p-3 transition-colors {project.status === opt.value ? 'border-primary bg-primary/5' : 'border-border bg-secondary/20 hover:border-border/80'}">
									<input type="radio" name="status" value={opt.value} bind:group={project.status} class="sr-only" />
									<div class="flex items-center gap-2">
										<span class="h-2.5 w-2.5 rounded-full {opt.value === 'active' ? 'bg-green-500' : opt.value === 'maintenance' ? 'bg-amber-500' : 'bg-zinc-500'}"></span>
										<span class="text-sm font-semibold text-foreground">{opt.label}</span>
										{#if project.status === opt.value}
											<CheckCircle size={14} class="ml-auto text-primary" />
										{/if}
									</div>
									<p class="mt-1 text-xs text-muted-foreground">{opt.description}</p>
								</label>
							{/each}
						</div>
					</fieldset>

					<!-- Divider -->
					<div class="border-t border-border"></div>

					<!-- Repo URL -->
					<div>
						<label for="s-repo" class="mb-1.5 flex items-center gap-2 text-sm font-semibold text-foreground">
							<GitBranch size={14} class="text-muted-foreground" /> Repository URL
						</label>
						<input
							id="s-repo"
							name="repo_url"
							type="url"
							bind:value={project.repo_url}
							class="w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground focus:border-primary focus:outline-none"
							placeholder="https://github.com/org/repo"
						/>
					</div>

					<!-- Staging URL -->
					<div>
						<label for="s-staging" class="mb-1.5 flex items-center gap-2 text-sm font-semibold text-foreground">
							<Globe size={14} class="text-muted-foreground" /> Staging URL
						</label>
						<input
							id="s-staging"
							name="staging_url"
							type="url"
							bind:value={project.staging_url}
							class="w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground focus:border-primary focus:outline-none"
							placeholder="https://staging.example.com"
						/>
					</div>

					<!-- Production URL -->
					<div>
						<label for="s-prod" class="mb-1.5 flex items-center gap-2 text-sm font-semibold text-foreground">
							<Rocket size={14} class="text-muted-foreground" /> Production URL
						</label>
						<input
							id="s-prod"
							name="production_url"
							type="url"
							bind:value={project.production_url}
							class="w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground focus:border-primary focus:outline-none"
							placeholder="https://example.com"
						/>
					</div>
				</div>

				<div class="flex items-center justify-between border-t border-border px-6 py-4">
					<button
						type="button"
						onclick={resetEdit}
						class="rounded-lg px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
					>
						Reset changes
					</button>
					<button
						type="submit"
						disabled={updateSubmitting}
						class="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
					>
						{#if updateSubmitting}
							<Loader size={16} class="animate-spin" /> Saving...
						{:else}
							<Save size={16} /> Save Changes
						{/if}
					</button>
				</div>
			</form>
		</div>
	</section>

	<!-- ─── Project Info ─────────────────────────────── -->
	<section class="mt-8">
		<h2 class="mb-4 text-lg font-semibold text-foreground">Project Info</h2>
		<div class="rounded-xl border border-border bg-card">
			<div class="divide-y divide-border">
				<div class="flex items-center justify-between px-6 py-4">
					<span class="text-sm font-medium text-muted-foreground">Project ID</span>
					<code class="rounded bg-secondary px-2 py-1 text-xs font-mono text-foreground">{data.project.id}</code>
				</div>
				<div class="flex items-center justify-between px-6 py-4">
					<span class="text-sm font-medium text-muted-foreground">Created</span>
					<span class="text-sm text-foreground">{new Date(data.project.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
				</div>
				<div class="flex items-center justify-between px-6 py-4">
					<span class="text-sm font-medium text-muted-foreground">Current Status</span>
					<span class="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold {data.project.status === 'active' ? 'bg-green-950/40 text-green-400' : data.project.status === 'maintenance' ? 'bg-amber-950/40 text-amber-400' : 'bg-zinc-800 text-zinc-400'}">
						<span class="h-1.5 w-1.5 rounded-full {data.project.status === 'active' ? 'bg-green-500' : data.project.status === 'maintenance' ? 'bg-amber-500' : 'bg-zinc-500'}"></span>
						{data.project.status.charAt(0).toUpperCase() + data.project.status.slice(1)}
					</span>
				</div>
				<div class="flex items-center justify-between px-6 py-4">
					<span class="text-sm font-medium text-muted-foreground">View Activity</span>
					<a
						href="/projects/{data.project.id}/activity"
						class="flex items-center gap-1.5 text-sm text-primary hover:underline"
					>
						<Activity size={14} /> Activity log
					</a>
				</div>
			</div>
		</div>
	</section>

	<!-- ─── Integrations ─────────────────────────────── -->
	<section class="mt-8">
		<h2 class="mb-4 text-lg font-semibold text-foreground">Integrations</h2>
		<div class="rounded-xl border border-border bg-card">
			<a
				href="/projects/{data.project.id}/settings/github"
				class="flex items-center justify-between px-6 py-4 transition-colors hover:bg-secondary/30"
			>
				<div class="flex items-center gap-3">
					<Github size={20} class="text-foreground" />
					<div>
						<p class="text-sm font-semibold text-foreground">GitHub</p>
						<p class="text-xs text-muted-foreground">Connect repo; sync branches, PRs, commits, and CI</p>
					</div>
				</div>
				<ChevronRight size={16} class="text-muted-foreground" />
			</a>
		</div>
	</section>

	<!-- ─── Danger Zone ──────────────────────────────── -->
	<section class="mt-8">
		<h2 class="mb-4 text-lg font-semibold text-red-400">Danger Zone</h2>
		<div class="rounded-xl border-2 border-red-900/50 bg-red-950/10">
			<div class="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h3 class="text-base font-semibold text-foreground">Delete this project</h3>
					<p class="mt-1 text-sm text-muted-foreground">
						Permanently deletes <strong class="text-foreground">{data.project.name}</strong> and all its data — specs, tasks, tests, incidents, reports, and activity. This action cannot be undone.
					</p>
				</div>
				<button
					type="button"
					onclick={() => { deleteOpen = true; deleteConfirmInput = ''; deleteError = ''; }}
					class="shrink-0 rounded-lg border border-red-800/60 bg-red-950/30 px-5 py-2.5 text-sm font-semibold text-red-400 transition-colors hover:bg-red-900/40 hover:text-red-300"
				>
					<span class="flex items-center gap-2"><Trash2 size={16} /> Delete Project</span>
				</button>
			</div>
		</div>
	</section>
</div>

<!-- ─── Delete Confirm Modal ─────────────────────── -->
{#if deleteOpen}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
		role="dialog"
		aria-modal="true"
		aria-label="Delete project"
	>
		<div class="w-full max-w-md rounded-2xl border border-red-900/60 bg-card shadow-2xl">
			<!-- Header -->
			<div class="border-b border-border px-6 py-5">
				<div class="flex items-center gap-3">
					<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-950/50">
						<Trash2 size={20} class="text-red-400" />
					</div>
					<div>
						<h3 class="text-lg font-bold text-foreground">Delete Project</h3>
						<p class="text-sm text-muted-foreground">This is permanent and cannot be reversed</p>
					</div>
				</div>
			</div>

			<!-- Body -->
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
			>
				<input type="hidden" name="project_name" value={data.project.name} />

				<div class="p-6 space-y-4">
					<div class="rounded-lg border border-amber-900/40 bg-amber-950/20 px-4 py-3">
						<p class="text-sm text-amber-300">
							<strong>Warning:</strong> All specs, tasks, tests, incidents, reports, GitHub-linked sync data, environments, and activity will be permanently deleted.
						</p>
					</div>

					<div>
						<label for="delete-confirm" class="mb-2 block text-sm font-medium text-foreground">
							Type <strong class="select-all font-mono text-red-400">{data.project.name}</strong> to confirm
						</label>
						<input
							id="delete-confirm"
							name="confirm"
							autocomplete="off"
							bind:value={deleteConfirmInput}
							class="w-full rounded-lg border border-input bg-background px-4 py-3 text-base text-foreground focus:border-red-600 focus:outline-none"
							placeholder="Type project name here..."
						/>
					</div>

					{#if deleteError}
						<div class="flex items-center gap-2 rounded-lg bg-red-900/30 px-4 py-3 text-sm text-red-300">
							<AlertTriangle size={14} class="shrink-0" /> {deleteError}
						</div>
					{/if}
				</div>

				<div class="flex gap-3 border-t border-border px-6 py-4">
					<button
						type="submit"
						disabled={!confirmMatch || deleteSubmitting}
						class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-700 py-3 text-sm font-bold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"
					>
						{#if deleteSubmitting}
							<Loader size={16} class="animate-spin" /> Deleting...
						{:else}
							<Trash2 size={16} /> Delete Project Forever
						{/if}
					</button>
					<button
						type="button"
						onclick={() => (deleteOpen = false)}
						class="rounded-lg bg-secondary px-5 py-3 text-sm font-medium text-foreground hover:bg-accent"
					>
						Cancel
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

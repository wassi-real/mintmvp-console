<script lang="ts">
	import { untrack } from 'svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ViewToggle from '$lib/components/ViewToggle.svelte';
	import { liveRefresh, OVERVIEW_TABLES } from '$lib/realtime';
	import { persistViewMode, type ViewMode } from '$lib/view-mode';
	import {
		ArrowRight,
		ExternalLink,
		FolderKanban,
		Loader,
		Plus,
		Rocket,
		Search,
		X
	} from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	let modalOpen = $state(false);
	let submitting = $state(false);
	let formError = $state('');
	let query = $state('');
	// Seeded from the cookie the server rendered with; the user owns it from then on.
	let view = $state<ViewMode>(untrack(() => data.viewMode));

	function setView(next: ViewMode) {
		view = next;
		persistViewMode(next);
	}

	$effect(() => liveRefresh(OVERVIEW_TABLES));

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return data.projects;
		return data.projects.filter((p) => p.name.toLowerCase().includes(q));
	});

	function timeAgo(dateStr: string | null | undefined): string {
		if (!dateStr) return 'Never';
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'Just now';
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.floor(hours / 24)}d ago`;
	}

	function delay(i: number) {
		return `${Math.min(i, 8) * 40}ms`;
	}

	function openModal() {
		formError = '';
		modalOpen = true;
	}
</script>

<svelte:head>
	<title>Projects Â· MintMVP Console</title>
</svelte:head>

<div class="scroll-area flex min-h-0 flex-1 flex-col overflow-y-auto">
	<div class="mx-auto w-full max-w-[1600px] px-4 pb-10 sm:px-6 lg:px-8">
		<!-- Sticky header -->
		<div
			class="sticky top-0 z-20 -mx-4 border-b border-border/60 bg-background/85 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
		>
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div class="min-w-0">
					<h1 class="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Projects</h1>
					<p class="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
						<span class="live-dot" aria-hidden="true"></span>
						{data.projects.length}
						{data.projects.length === 1 ? 'project' : 'projects'} Â· live
					</p>
				</div>

				<div class="flex items-center gap-2">
					<ViewToggle mode={view} onChange={setView} />
					<button
						onclick={openModal}
						class="press flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
					>
						<Plus size={18} />
						<span class="hidden sm:inline">New Project</span>
						<span class="sm:hidden">New</span>
					</button>
				</div>
			</div>

			{#if data.projects.length > 0}
				<div class="relative mt-3 w-full sm:max-w-sm">
					<Search
						size={17}
						class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
					/>
					<input
						type="text"
						bind:value={query}
						placeholder="Search projectsâ€¦"
						aria-label="Search projects"
						class="w-full rounded-lg border border-input bg-card py-2.5 pl-11 pr-10 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
					/>
					{#if query}
						<button
							onclick={() => (query = '')}
							aria-label="Clear search"
							class="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
						>
							<X size={15} />
						</button>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Create Project Modal -->
		<Modal bind:open={modalOpen} title="New Project">
			<form
				method="POST"
				action="?/create"
				use:enhance={() => {
					submitting = true;
					formError = '';
					return async ({ result }) => {
						submitting = false;
						if (result.type === 'failure') {
							formError = (result.data as any)?.error ?? 'Something went wrong.';
						} else if (result.type === 'success' || result.type === 'redirect') {
							modalOpen = false;
							await invalidateAll();
						}
					};
				}}
			>
				{#if formError}
					<div class="mb-4 rounded-lg bg-red-900/30 px-4 py-3 text-base font-medium text-red-300">
						{formError}
					</div>
				{/if}

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div class="sm:col-span-2">
						<label for="name" class="mb-1 block text-base font-medium text-foreground">
							Project Name <span class="text-destructive">*</span>
						</label>
						<input
							id="name"
							name="name"
							required
							class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
							placeholder="Trivia App"
						/>
					</div>

					<div>
						<label for="status" class="mb-1 block text-base font-medium text-foreground">Status</label>
						<select
							id="status"
							name="status"
							class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
						>
							<option value="active">Active</option>
							<option value="maintenance">Maintenance</option>
							<option value="paused">Paused</option>
						</select>
					</div>

					<div>
						<label for="repo_url" class="mb-1 block text-base font-medium text-foreground">
							Repository URL
						</label>
						<input
							id="repo_url"
							name="repo_url"
							type="url"
							class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
							placeholder="https://github.com/org/repo"
						/>
					</div>

					<div>
						<label for="staging_url" class="mb-1 block text-base font-medium text-foreground">
							Staging URL
						</label>
						<input
							id="staging_url"
							name="staging_url"
							type="url"
							class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
							placeholder="https://staging.yourapp.com"
						/>
					</div>

					<div>
						<label for="production_url" class="mb-1 block text-base font-medium text-foreground">
							Production URL
						</label>
						<input
							id="production_url"
							name="production_url"
							type="url"
							class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring"
							placeholder="https://yourapp.com"
						/>
					</div>
				</div>

				<div class="mt-6 flex gap-3">
					<button
						type="submit"
						disabled={submitting}
						class="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
					>
						{#if submitting}
							<Loader size={18} class="animate-spin" />
							Creating...
						{:else}
							Create Project
						{/if}
					</button>
					<button
						type="button"
						onclick={() => (modalOpen = false)}
						class="rounded-lg bg-secondary px-6 py-3 text-base font-medium text-foreground hover:bg-accent"
					>
						Cancel
					</button>
				</div>
			</form>
		</Modal>

		{#if data.projects.length === 0}
			<div class="mt-12 flex flex-col items-center justify-center text-center">
				<EmptyState
					icon={FolderKanban}
					title="No projects yet"
					description="Create your first project to get started."
				/>
				<button
					onclick={openModal}
					class="press mt-4 flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90"
				>
					<Plus size={20} />
					Create a Project
				</button>
			</div>
		{:else if filtered.length === 0}
			<div class="mt-12 text-center">
				<p class="text-lg font-medium text-foreground">No projects match â€œ{query}â€</p>
				<button
					onclick={() => (query = '')}
					class="mt-3 rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
				>
					Clear search
				</button>
			</div>
		{:else if view === 'grid'}
			<div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
				{#each filtered as project, i (project.id)}
					<div
						class="rise card-hover group relative flex flex-col rounded-2xl border border-border bg-card p-5"
						style:--delay={delay(i)}
					>
						<div class="flex items-start justify-between gap-3">
							<a href="/projects/{project.id}" class="min-w-0 after:absolute after:inset-0">
								<h2 class="truncate text-lg font-bold text-foreground">{project.name}</h2>
								<p class="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
									<Rocket size={13} />
									{timeAgo(project.lastDeploy?.created_at)}
								</p>
							</a>
							<StatusBadge status={project.status} size="sm" />
						</div>

						<div class="mt-4 flex items-center justify-between gap-3">
							<div class="flex items-center gap-2">
								{#if project.staging_url}
									<a
										href={project.staging_url}
										target="_blank"
										rel="noopener"
										class="relative z-10 inline-flex items-center gap-1 rounded-md bg-secondary/60 px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
									>
										<ExternalLink size={12} /> Staging
									</a>
								{/if}
								{#if project.production_url}
									<a
										href={project.production_url}
										target="_blank"
										rel="noopener"
										class="relative z-10 inline-flex items-center gap-1 rounded-md bg-secondary/60 px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
									>
										<ExternalLink size={12} /> Live
									</a>
								{/if}
								{#if !project.staging_url && !project.production_url}
									<span class="text-xs text-muted-foreground">No environments</span>
								{/if}
							</div>

							{#if project.openIncidents > 0}
								<span class="text-sm font-bold tabular-nums text-destructive">
									{project.openIncidents} open
								</span>
							{:else}
								<span class="text-sm font-semibold text-success">Healthy</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<div class="mt-6 overflow-x-auto rounded-xl border border-border">
				<table class="w-full min-w-[52rem] text-left">
					<thead class="border-b border-border bg-secondary/40">
						<tr>
							<th class="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</th>
							<th class="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
							<th class="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Staging</th>
							<th class="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Production</th>
							<th class="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last Deploy</th>
							<th class="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Issues</th>
							<th class="px-5 py-3"></th>
						</tr>
					</thead>
					<tbody>
						{#each filtered as project, i (project.id)}
							<tr class="rise row-hover border-b border-border/60 last:border-b-0" style:--delay={delay(i)}>
								<td class="px-5 py-3.5">
									<a
										href="/projects/{project.id}"
										class="text-base font-semibold text-foreground hover:underline"
									>
										{project.name}
									</a>
								</td>
								<td class="px-5 py-3.5"><StatusBadge status={project.status} size="sm" /></td>
								<td class="px-5 py-3.5">
									{#if project.staging_url}
										<a
											href={project.staging_url}
											target="_blank"
											rel="noopener"
											class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
										>
											<ExternalLink size={14} /> Open
										</a>
									{:else}
										<span class="text-sm text-muted-foreground">--</span>
									{/if}
								</td>
								<td class="px-5 py-3.5">
									{#if project.production_url}
										<a
											href={project.production_url}
											target="_blank"
											rel="noopener"
											class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
										>
											<ExternalLink size={14} /> Open
										</a>
									{:else}
										<span class="text-sm text-muted-foreground">--</span>
									{/if}
								</td>
								<td class="px-5 py-3.5 text-sm text-muted-foreground">
									{timeAgo(project.lastDeploy?.created_at)}
								</td>
								<td class="px-5 py-3.5">
									{#if project.openIncidents > 0}
										<span class="text-base font-bold tabular-nums text-destructive">
											{project.openIncidents}
										</span>
									{:else}
										<span class="text-base font-bold text-success">0</span>
									{/if}
								</td>
								<td class="px-5 py-3.5 text-right">
									<a
										href="/projects/{project.id}"
										aria-label="Open {project.name}"
										class="inline-flex rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
									>
										<ArrowRight size={16} />
									</a>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>

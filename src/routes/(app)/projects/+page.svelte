<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import EmptyState from '$lib/components/EmptyState.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { ExternalLink, FolderKanban, Plus, Loader } from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';

	let { data } = $props();

	let modalOpen = $state(false);
	let submitting = $state(false);
	let formError = $state('');

	function timeAgo(dateStr: string | null): string {
		if (!dateStr) return 'Never';
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	}

	function openModal() {
		formError = '';
		modalOpen = true;
	}
</script>

<div class="p-4 sm:p-6 lg:p-8">
	<PageHeader title="Projects" description="All client projects">
		{#snippet actions()}
			<button
				onclick={openModal}
				class="flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
			>
				<Plus size={20} />
				New Project
			</button>
		{/snippet}
	</PageHeader>

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
				class="mt-4 flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90"
			>
				<Plus size={20} />
				Create a Project
			</button>
		</div>
	{:else}
		<div class="mt-8 overflow-hidden rounded-xl border border-border">
			<table class="w-full text-left">
				<thead class="border-b border-border bg-secondary/50">
					<tr>
						<th class="px-6 py-4 text-base font-semibold text-foreground">Name</th>
						<th class="px-6 py-4 text-base font-semibold text-foreground">Status</th>
						<th class="px-6 py-4 text-base font-semibold text-foreground">Staging</th>
						<th class="px-6 py-4 text-base font-semibold text-foreground">Production</th>
						<th class="px-6 py-4 text-base font-semibold text-foreground">Last Deploy</th>
						<th class="px-6 py-4 text-base font-semibold text-foreground">Issues</th>
					</tr>
				</thead>
				<tbody>
					{#each data.projects as project}
						<tr class="border-b border-border transition-colors hover:bg-secondary/30">
							<td class="px-6 py-4">
								<a
									href="/projects/{project.id}"
									class="text-lg font-semibold text-foreground hover:underline"
								>
									{project.name}
								</a>
							</td>
							<td class="px-6 py-4">
								<StatusBadge status={project.status} />
							</td>
							<td class="px-6 py-4">
								{#if project.staging_url}
									<a
										href={project.staging_url}
										target="_blank"
										rel="noopener"
										class="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
									>
										<ExternalLink size={16} />
										Open
									</a>
								{:else}
									<span class="text-muted-foreground">--</span>
								{/if}
							</td>
							<td class="px-6 py-4">
								{#if project.production_url}
									<a
										href={project.production_url}
										target="_blank"
										rel="noopener"
										class="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
									>
										<ExternalLink size={16} />
										Open
									</a>
								{:else}
									<span class="text-muted-foreground">--</span>
								{/if}
							</td>
							<td class="px-6 py-4 text-muted-foreground">
								{timeAgo(project.lastDeploy?.created_at)}
							</td>
							<td class="px-6 py-4">
								{#if project.openIncidents > 0}
									<span class="text-lg font-bold text-destructive">{project.openIncidents}</span>
								{:else}
									<span class="text-lg font-bold text-success">0</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

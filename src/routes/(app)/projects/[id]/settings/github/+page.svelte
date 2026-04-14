<script lang="ts">
	import { enhance } from '$app/forms';
	import Modal from '$lib/components/Modal.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import {
		Github,
		Link2,
		Unlink,
		AlertTriangle,
		CheckCircle2,
		GitBranch,
		GitPullRequest,
		GitCommitHorizontal,
		Play,
		Rocket,
		ArrowLeft
	} from 'lucide-svelte';

	let { data, form } = $props();

	let connectSubmitting = $state(false);
	let disconnectOpen = $state(false);
	let disconnectSubmitting = $state(false);

	let installationId = $state('');
	let selectedRepo = $state('');

	const repos: { id: number; full_name: string; name: string; owner: { login: string } }[] =
		$derived((form as any)?.repos ?? []);
	const step: string = $derived((form as any)?.step ?? '');
	const formToken: string = $derived((form as any)?.token ?? '');
	const formExpiresAt: string = $derived((form as any)?.expires_at ?? '');
	const formInstallationId: number = $derived((form as any)?.installation_id ?? 0);
	const syncCounts: any = $derived((form as any)?.syncCounts ?? null);
	const permissionWarning: string | undefined = $derived(
		form && typeof (form as any)?.permissionWarning === 'string'
			? ((form as any).permissionWarning as string)
			: undefined
	);

	function timeAgo(d: string | null) {
		if (!d) return 'Never';
		const diff = Date.now() - new Date(d).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return 'Just now';
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		if (hours < 24) return `${hours}h ago`;
		return `${Math.floor(hours / 24)}d ago`;
	}
</script>

<div class="mx-auto max-w-2xl">
	<!-- Back link -->
	<a
		href="/projects/{data.project.id}/settings"
		class="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
	>
		<ArrowLeft size={14} />
		Back to Settings
	</a>

	<div class="flex items-center gap-3">
		<Github size={28} class="text-foreground" />
		<h1 class="text-2xl font-bold text-foreground">GitHub Integration</h1>
	</div>
	<p class="mt-2 text-sm text-muted-foreground">
		Connect a GitHub repository to automatically sync branches, pull requests, commits, and CI runs.
	</p>

	{#if !data.githubConfigured}
		<!-- Not configured banner -->
		<div
			class="mt-6 rounded-xl border-2 border-amber-900/50 bg-amber-950/20 p-6 text-center"
		>
			<AlertTriangle size={32} class="mx-auto text-amber-400" />
			<h3 class="mt-3 text-lg font-semibold text-foreground">GitHub App Not Configured</h3>
			<p class="mt-1 text-sm text-muted-foreground">
				Server environment variables for the GitHub App are not set. Add
				<code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">GITHUB_APP_ID</code>,
				<code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">GITHUB_APP_PRIVATE_KEY</code>, and
				<code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">GITHUB_WEBHOOK_SECRET</code>
				to your <code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">.env</code> file.
			</p>
		</div>
	{:else if data.integration}
		<!-- ─── Connected state ─────────────────────────── -->
		<div class="mt-6 rounded-xl border-2 border-green-900/50 bg-green-950/10 p-6">
			<div class="flex items-start justify-between">
				<div class="flex items-center gap-3">
					<CheckCircle2 size={24} class="text-green-400" />
					<div>
						<h3 class="text-lg font-semibold text-foreground">Connected</h3>
						<p class="text-sm text-muted-foreground">
							<span class="font-mono font-semibold text-foreground"
								>{data.integration.repo_owner}/{data.integration.repo_name}</span
							>
						</p>
					</div>
				</div>
				<StatusBadge status="active" size="sm" />
			</div>

			{#if permissionWarning}
				<div
					class="mt-4 flex gap-3 rounded-lg border border-amber-600/50 bg-amber-950/25 p-4 text-sm text-foreground"
				>
					<AlertTriangle size={20} class="mt-0.5 shrink-0 text-amber-400" />
					<p>{permissionWarning}</p>
				</div>
			{/if}

			<div class="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
				<div>
					<p class="text-xs text-muted-foreground">Installation ID</p>
					<p class="font-mono text-foreground">{data.integration.installation_id}</p>
				</div>
				<div>
					<p class="text-xs text-muted-foreground">Last Sync</p>
					<p class="text-foreground">{timeAgo(data.integration.last_sync_at)}</p>
				</div>
				<div>
					<p class="text-xs text-muted-foreground">Connected</p>
					<p class="text-foreground">{timeAgo(data.integration.created_at)}</p>
				</div>
			</div>

			{#if syncCounts}
				<div
					class="mt-4 rounded-lg border border-green-900/40 bg-green-950/20 px-4 py-3 text-sm"
				>
					<p class="font-semibold text-green-400">Sync Complete</p>
					<div class="mt-1 flex flex-wrap gap-3 text-muted-foreground">
						<span class="flex items-center gap-1"><GitBranch size={12} />{syncCounts.branches} branches</span>
						<span class="flex items-center gap-1"><GitPullRequest size={12} />{syncCounts.prs} PRs</span>
						<span class="flex items-center gap-1"><GitCommitHorizontal size={12} />{syncCounts.commits} commits</span>
						<span class="flex items-center gap-1"><Play size={12} />{syncCounts.ciRuns} CI runs</span>
						<span class="flex items-center gap-1"><Rocket size={12} />{syncCounts.deployments} GitHub deploy events</span>
					</div>
				</div>
			{/if}

			<div class="mt-5 space-y-4">
				<p class="text-sm text-muted-foreground">
					Branches, commits, and CI data are pulled from GitHub automatically about every five minutes while you browse this project.
				</p>
				<button
					type="button"
					onclick={() => (disconnectOpen = true)}
					class="inline-flex items-center gap-2 rounded-lg bg-red-900/30 px-4 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-900/50"
				>
					<Unlink size={16} />
					Disconnect
				</button>
			</div>
		</div>

		<!-- Disconnect modal -->
		<Modal bind:open={disconnectOpen} title="Disconnect GitHub">
			<form
				method="POST"
				action="?/disconnect"
				use:enhance={() => {
					disconnectSubmitting = true;
					return async ({ update }) => {
						await update();
						disconnectSubmitting = false;
						disconnectOpen = false;
					};
				}}
			>
				<div class="flex items-start gap-3">
					<AlertTriangle size={24} class="mt-0.5 shrink-0 text-red-400" />
					<p class="text-sm text-muted-foreground">
						This will remove the GitHub connection and delete all synced data (branches, PRs,
						commits, CI runs, and related GitHub records). Manual entries are unaffected.
					</p>
				</div>
				<div class="mt-6 flex justify-end gap-3">
					<button
						type="button"
						onclick={() => (disconnectOpen = false)}
						class="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/80"
						>Cancel</button
					>
					<button
						type="submit"
						disabled={disconnectSubmitting}
						class="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
						>Disconnect</button
					>
				</div>
			</form>
		</Modal>
	{:else if step === 'select_repo' && repos.length > 0}
		<!-- ─── Step 2: Select repository ──────────────── -->
		<div class="mt-6 rounded-xl border border-border bg-card p-6">
			<h3 class="text-lg font-semibold text-foreground">Select Repository</h3>
			<p class="mt-1 text-sm text-muted-foreground">
				Choose which repository to connect to this project.
			</p>

			<form
				method="POST"
				action="?/selectRepo"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
					};
				}}
				class="mt-4 space-y-4"
			>
				<input type="hidden" name="installation_id" value={formInstallationId} />
				<input type="hidden" name="token" value={formToken} />
				<input type="hidden" name="expires_at" value={formExpiresAt} />

				<div class="max-h-64 space-y-2 overflow-y-auto">
					{#each repos as repo}
						<label
							class="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-secondary/50 {selectedRepo ===
							repo.full_name
								? 'border-primary bg-primary/10'
								: ''}"
						>
							<input
								type="radio"
								name="repo_full"
								value={repo.full_name}
								bind:group={selectedRepo}
								class="accent-primary"
							/>
							<Github size={16} class="text-muted-foreground" />
							<span class="text-sm font-medium text-foreground">{repo.full_name}</span>
						</label>
					{/each}
				</div>

				{#if selectedRepo}
					{@const parts = selectedRepo.split('/')}
					<input type="hidden" name="repo_owner" value={parts[0]} />
					<input type="hidden" name="repo_name" value={parts[1]} />
				{/if}

				{#if form && 'error' in form}
					<p class="text-sm text-red-400">{form.error}</p>
				{/if}

				<div class="flex justify-end gap-3">
					<button
						type="submit"
						disabled={!selectedRepo}
						class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
						>Connect Repository</button
					>
				</div>
			</form>
		</div>
	{:else}
		<!-- ─── Step 1: Enter Installation ID ──────────── -->
		<div class="mt-6 rounded-xl border border-border bg-card p-6">
			<h3 class="text-lg font-semibold text-foreground">Connect GitHub App</h3>
			<p class="mt-1 text-sm text-muted-foreground">
				Install the MintMVP GitHub App on your organization, then enter the Installation ID below.
				You can find it in the URL after installing: <code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">github.com/settings/installations/&lt;ID&gt;</code>
			</p>

			<form
				method="POST"
				action="?/connect"
				use:enhance={() => {
					connectSubmitting = true;
					return async ({ update }) => {
						await update();
						connectSubmitting = false;
					};
				}}
				class="mt-4 space-y-4"
			>
				<div>
					<label for="gh-install-id" class="mb-1 block text-sm font-medium text-foreground"
						>Installation ID</label
					>
					<input
						id="gh-install-id"
						name="installation_id"
						type="number"
						required
						bind:value={installationId}
						placeholder="12345678"
						class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
					/>
				</div>

				{#if form && 'error' in form && step !== 'select_repo'}
					<p class="text-sm text-red-400">{form.error}</p>
				{/if}

				<div class="flex justify-end">
					<button
						type="submit"
						disabled={connectSubmitting || !installationId}
						class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
					>
						<Link2 size={16} />
						{connectSubmitting ? 'Connecting…' : 'Connect'}
					</button>
				</div>
			</form>
		</div>

		<!-- Setup instructions -->
		<div class="mt-6 rounded-xl border border-border bg-card p-6">
			<h3 class="text-base font-semibold text-foreground">Setup Instructions</h3>
			<ol class="mt-3 space-y-2 text-sm text-muted-foreground">
				<li class="flex gap-2">
					<span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">1</span>
					<span>Create a <a href="https://github.com/settings/apps/new" target="_blank" class="text-primary underline">GitHub App</a> with permissions for Contents, Pull Requests, Deployments, Actions, and Webhooks.</span>
				</li>
				<li class="flex gap-2">
					<span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">2</span>
					<span>Set your webhook URL to <code class="rounded bg-secondary px-1 py-0.5 font-mono text-xs">https://your-domain/api/github/webhook</code></span>
				</li>
				<li class="flex gap-2">
					<span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">3</span>
					<span>Add <code class="rounded bg-secondary px-1 py-0.5 font-mono text-xs">GITHUB_APP_ID</code>, <code class="rounded bg-secondary px-1 py-0.5 font-mono text-xs">GITHUB_APP_PRIVATE_KEY</code>, <code class="rounded bg-secondary px-1 py-0.5 font-mono text-xs">GITHUB_WEBHOOK_SECRET</code> to your environment.</span>
				</li>
				<li class="flex gap-2">
					<span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">4</span>
					<span>Install the GitHub App on your organization and note the Installation ID.</span>
				</li>
			</ol>
		</div>
	{/if}
</div>

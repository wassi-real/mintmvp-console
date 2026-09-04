<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Modal from '$lib/components/Modal.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import PageTitleBar from '$lib/components/PageTitleBar.svelte';
	import {
		Github,
		Link2,
		RefreshCw,
		Loader,
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
	let syncSubmitting = $state(false);
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
	const syncFormError = $derived(
		form && typeof (form as { error?: string })?.error === 'string'
			? (form as { error: string }).error
			: ''
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

	const codeClass = 'rounded bg-secondary px-1.5 py-0.5 font-mono text-xs text-foreground';
	const stepChipClass =
		'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold tabular-nums text-foreground';

	const syncStats = $derived(
		syncCounts
			? [
					{ label: 'Branches', value: syncCounts.branches, icon: GitBranch },
					{ label: 'PRs', value: syncCounts.prs, icon: GitPullRequest },
					{ label: 'Commits', value: syncCounts.commits, icon: GitCommitHorizontal },
					{ label: 'CI runs', value: syncCounts.ciRuns, icon: Play },
					{ label: 'Deploy events', value: syncCounts.deployments, icon: Rocket }
				]
			: []
	);
</script>

<PageTitleBar title="GitHub Integration">
	{#snippet meta()}
		<a
			href="/projects/{data.project.id}/settings"
			class="inline-flex items-center gap-1.5 transition-colors hover:text-foreground"
		>
			<ArrowLeft size={13} /> Settings
		</a>
		<span class="text-muted-foreground/40">/</span>
		{#if data.integration}
			<span class="truncate font-mono text-foreground"
				>{data.integration.repo_owner}/{data.integration.repo_name}</span
			>
		{:else}
			<span>Not connected</span>
		{/if}
	{/snippet}

	{#snippet actions()}
		{#if data.githubConfigured && data.integration}
			<form
				method="POST"
				action="?/sync"
				use:enhance={() => {
					syncSubmitting = true;
					return async ({ update }) => {
						await update();
						syncSubmitting = false;
						await invalidateAll();
					};
				}}
			>
				<button
					type="submit"
					disabled={syncSubmitting}
					class="press inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
				>
					{#if syncSubmitting}
						<Loader size={15} class="animate-spin" />
						Syncing…
					{:else}
						<RefreshCw size={15} />
						Sync now
					{/if}
				</button>
			</form>
			<button
				type="button"
				onclick={() => (disconnectOpen = true)}
				class="press inline-flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/20"
			>
				<Unlink size={15} />
				<span class="hidden sm:inline">Disconnect</span>
			</button>
		{/if}
	{/snippet}
</PageTitleBar>

<div class="mx-auto w-full max-w-3xl space-y-4 pb-4">
	{#if !data.githubConfigured}
		<!-- ─── Not configured ───────────────────────────── -->
		<div class="rise rounded-xl border border-warning/40 bg-warning/10 p-5 text-center">
			<AlertTriangle size={28} class="mx-auto text-warning" />
			<h2 class="mt-3 text-base font-semibold text-foreground">GitHub App not configured</h2>
			<p class="mx-auto mt-1.5 max-w-lg text-sm text-muted-foreground">
				Server environment variables for the GitHub App are not set. Add
				<code class={codeClass}>GITHUB_APP_ID</code>,
				<code class={codeClass}>GITHUB_APP_PRIVATE_KEY</code>, and
				<code class={codeClass}>GITHUB_WEBHOOK_SECRET</code>
				to your <code class={codeClass}>.env</code> file.
			</p>
		</div>
	{:else if data.integration}
		<!-- ─── Connected ────────────────────────────────── -->
		<section class="rise rounded-xl border border-border bg-card">
			<div
				class="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-5"
			>
				<div class="flex min-w-0 items-center gap-2.5">
					<CheckCircle2 size={18} class="shrink-0 text-success" />
					<div class="min-w-0">
						<h2 class="text-sm font-semibold text-foreground">Connected</h2>
						<p class="truncate font-mono text-xs text-muted-foreground">
							{data.integration.repo_owner}/{data.integration.repo_name}
						</p>
					</div>
				</div>
				<StatusBadge status="active" size="sm" />
			</div>

			<div class="grid grid-cols-2 gap-x-4 gap-y-4 p-4 sm:grid-cols-4 sm:p-5">
				<div class="col-span-2 min-w-0">
					<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
						Repository
					</p>
					<p class="mt-1 truncate font-mono text-sm font-semibold text-foreground">
						{data.integration.repo_owner}/{data.integration.repo_name}
					</p>
				</div>
				<div class="min-w-0">
					<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
						Installation
					</p>
					<p class="mt-1 truncate font-mono text-sm font-semibold tabular-nums text-foreground">
						{data.integration.installation_id}
					</p>
				</div>
				<div class="min-w-0">
					<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last sync</p>
					<p class="mt-1 truncate text-sm font-semibold tabular-nums text-foreground">
						{timeAgo(data.integration.last_sync_at)}
					</p>
				</div>
				<div class="min-w-0">
					<p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Connected</p>
					<p class="mt-1 truncate text-sm font-semibold tabular-nums text-foreground">
						{timeAgo(data.integration.created_at)}
					</p>
				</div>
			</div>

			<div class="space-y-3 border-t border-border/60 px-4 py-4 sm:px-5">
				{#if permissionWarning}
					<div
						class="flex gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-foreground"
					>
						<AlertTriangle size={17} class="mt-0.5 shrink-0 text-warning" />
						<p>{permissionWarning}</p>
					</div>
				{/if}

				{#if syncFormError}
					<div
						class="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
					>
						{syncFormError}
					</div>
				{/if}

				{#if syncCounts}
					<div class="rounded-lg border border-success/40 bg-success/10 p-3">
						<p class="text-xs font-semibold uppercase tracking-wide text-success">Sync complete</p>
						<div class="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-5">
							{#each syncStats as stat (stat.label)}
								{@const StatIcon = stat.icon}
								<div class="min-w-0">
									<p class="flex items-center gap-1 text-xs text-muted-foreground">
										<StatIcon size={12} class="shrink-0" />
										<span class="truncate">{stat.label}</span>
									</p>
									<p class="mt-0.5 text-sm font-bold tabular-nums text-foreground">{stat.value}</p>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<p class="text-xs text-muted-foreground">
					Branches, commits, and CI data refresh automatically about every five minutes while you
					browse this project. Use <strong class="font-semibold text-foreground">Sync now</strong> to
					pull immediately.
				</p>
			</div>
		</section>

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
				<div
					class="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4"
				>
					<AlertTriangle size={20} class="mt-0.5 shrink-0 text-destructive" />
					<p class="text-sm text-muted-foreground">
						This will remove the GitHub connection and delete all synced data (branches, PRs,
						commits, CI runs, and related GitHub records). Manual entries are unaffected.
					</p>
				</div>
				<div class="mt-6 flex justify-end gap-3">
					<button
						type="button"
						onclick={() => (disconnectOpen = false)}
						class="press rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
						>Cancel</button
					>
					<button
						type="submit"
						disabled={disconnectSubmitting}
						class="press rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
						>Disconnect</button
					>
				</div>
			</form>
		</Modal>
	{:else if step === 'select_repo' && repos.length > 0}
		<!-- ─── Step 2: select repository ────────────────── -->
		<section class="rise rounded-xl border border-border bg-card">
			<div class="border-b border-border/60 px-4 py-3 sm:px-5">
				<h2 class="text-sm font-semibold text-foreground">Select repository</h2>
				<p class="mt-0.5 text-xs text-muted-foreground">
					Choose which repository to connect to this project.
				</p>
			</div>

			<form
				method="POST"
				action="?/selectRepo"
				use:enhance={() => {
					return async ({ update }) => {
						await update();
					};
				}}
				class="space-y-4 p-4 sm:p-5"
			>
				<input type="hidden" name="installation_id" value={formInstallationId} />
				<input type="hidden" name="token" value={formToken} />
				<input type="hidden" name="expires_at" value={formExpiresAt} />

				<div class="scroll-area max-h-72 space-y-1.5 overflow-y-auto pr-1">
					{#each repos as repo, i (repo.id)}
						<label
							class="rise row-hover flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 transition-colors {selectedRepo ===
							repo.full_name
								? 'border-ring bg-secondary/60'
								: 'border-border'}"
							style:--delay={`${Math.min(i, 8) * 40}ms`}
						>
							<input
								type="radio"
								name="repo_full"
								value={repo.full_name}
								bind:group={selectedRepo}
								class="accent-primary"
							/>
							<Github size={15} class="shrink-0 text-muted-foreground" />
							<span class="truncate font-mono text-sm text-foreground">{repo.full_name}</span>
						</label>
					{/each}
				</div>

				{#if selectedRepo}
					{@const parts = selectedRepo.split('/')}
					<input type="hidden" name="repo_owner" value={parts[0]} />
					<input type="hidden" name="repo_name" value={parts[1]} />
				{/if}

				{#if form && 'error' in form}
					<p class="text-sm text-destructive">{form.error}</p>
				{/if}

				<div class="flex justify-end">
					<button
						type="submit"
						disabled={!selectedRepo}
						class="press rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
						>Connect repository</button
					>
				</div>
			</form>
		</section>
	{:else}
		<!-- ─── Step 1: installation ID ──────────────────── -->
		<section class="rise rounded-xl border border-border bg-card">
			<div class="border-b border-border/60 px-4 py-3 sm:px-5">
				<h2 class="text-sm font-semibold text-foreground">Connect GitHub App</h2>
				<p class="mt-0.5 text-xs text-muted-foreground">
					Install the MintMVP GitHub App on your organization, then enter the Installation ID. You
					can find it in the URL after installing:
					<code class={codeClass}>github.com/settings/installations/&lt;ID&gt;</code>
				</p>
			</div>

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
				class="space-y-4 p-4 sm:p-5"
			>
				<div>
					<label
						for="gh-install-id"
						class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground"
						>Installation ID</label
					>
					<input
						id="gh-install-id"
						name="installation_id"
						type="number"
						required
						bind:value={installationId}
						placeholder="12345678"
						class="w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm tabular-nums text-foreground transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none"
					/>
				</div>

				{#if form && 'error' in form && step !== 'select_repo'}
					<p class="text-sm text-destructive">{form.error}</p>
				{/if}

				<div class="flex justify-end">
					<button
						type="submit"
						disabled={connectSubmitting || !installationId}
						class="press flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
					>
						<Link2 size={15} />
						{connectSubmitting ? 'Connecting…' : 'Connect'}
					</button>
				</div>
			</form>
		</section>

		<!-- Setup instructions -->
		<section class="rise rounded-xl border border-border bg-card" style:--delay="40ms">
			<div class="border-b border-border/60 px-4 py-3 sm:px-5">
				<h2 class="text-sm font-semibold text-foreground">Setup instructions</h2>
			</div>
			<ol class="space-y-2.5 p-4 text-sm text-muted-foreground sm:p-5">
				<li class="flex gap-2.5">
					<span class={stepChipClass}>1</span>
					<span
						>Create a <a
							href="https://github.com/settings/apps/new"
							target="_blank"
							rel="noopener"
							class="font-medium text-foreground underline">GitHub App</a
						> with permissions for Contents, Pull Requests, Deployments, Actions, and Webhooks.</span
					>
				</li>
				<li class="flex gap-2.5">
					<span class={stepChipClass}>2</span>
					<span
						>Set your webhook URL to
						<code class={codeClass}>https://your-domain/api/github/webhook</code></span
					>
				</li>
				<li class="flex gap-2.5">
					<span class={stepChipClass}>3</span>
					<span
						>Add <code class={codeClass}>GITHUB_APP_ID</code>,
						<code class={codeClass}>GITHUB_APP_PRIVATE_KEY</code>,
						<code class={codeClass}>GITHUB_WEBHOOK_SECRET</code> to your environment.</span
					>
				</li>
				<li class="flex gap-2.5">
					<span class={stepChipClass}>4</span>
					<span>Install the GitHub App on your organization and note the Installation ID.</span>
				</li>
			</ol>
		</section>
	{/if}
</div>

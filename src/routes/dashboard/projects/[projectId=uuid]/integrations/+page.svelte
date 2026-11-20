<script lang="ts">
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import Form from '#lib/components/Form.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Time from '#lib/components/Time.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let disconnecting = $state<'github' | 'railway' | null>(null);
	let disconnectOpen = $state(false);
</script>

<svelte:head>
	<title>Integrations · {data.project.name}</title>
</svelte:head>

<PageHeader
	title="Integrations"
	description="Connect the services this project uses. Tokens are stored for this project only and are never shown again."
/>

<div class="grid max-w-3xl gap-8">
	<section class="panel">
		<header class="panel-header">
			<h2 class="panel-title">GitHub</h2>
			{#if data.github}<span class="chip text-ok">Connected</span>{/if}
		</header>
		<div class="panel-body">
			<p class="mb-6 text-muted">
				Reads branches, commits, pull requests, workflow runs and deployments into the Code, Builds
				and Deployments pages.
				{#if data.github}
					Last synced <Time value={data.github.lastSyncAt} relative fallback="never" />.
				{/if}
			</p>

			<Form action="?/github" reset={false}>
				{#snippet children({ pending, errors })}
					<div class="grid gap-5 sm:grid-cols-2">
						<div>
							<label class="label" for="repo_owner">Repository owner</label>
							<input
								id="repo_owner"
								name="repo_owner"
								class="input"
								required
								maxlength="100"
								autocapitalize="none"
								spellcheck="false"
								value={data.github?.owner ?? ''}
								placeholder="for example: acme"
								aria-invalid={errors.repo_owner ? 'true' : undefined}
							/>
							{#if errors.repo_owner}<p class="field-error">{errors.repo_owner}</p>{/if}
						</div>
						<div>
							<label class="label" for="repo_name">Repository name</label>
							<input
								id="repo_name"
								name="repo_name"
								class="input"
								required
								maxlength="100"
								autocapitalize="none"
								spellcheck="false"
								value={data.github?.repo ?? ''}
								placeholder="for example: web-app"
								aria-invalid={errors.repo_name ? 'true' : undefined}
							/>
							{#if errors.repo_name}<p class="field-error">{errors.repo_name}</p>{/if}
						</div>
					</div>
					<div class="mt-5">
						<label class="label" for="access_token">
							Personal access token
							{#if data.github?.hasToken}<span class="font-normal text-muted">(leave blank to keep the saved one)</span>{/if}
						</label>
						<input
							id="access_token"
							name="access_token"
							type="password"
							class="input"
							autocomplete="off"
							maxlength="500"
							placeholder={data.github?.hasToken ? '••••••••••••' : 'ghp_…'}
							aria-invalid={errors.access_token ? 'true' : undefined}
						/>
						<p class={errors.access_token ? 'field-error' : 'hint'}>
							{errors.access_token || 'A fine-grained token with read access to the repository is enough.'}
						</p>
					</div>
					<div class="mt-7 flex flex-wrap justify-between gap-3">
						{#if data.github}
							<button
								type="button"
								class="btn btn-danger"
								onclick={() => {
									disconnecting = 'github';
									disconnectOpen = true;
								}}
							>
								Disconnect
							</button>
						{:else}
							<span></span>
						{/if}
						<button type="submit" class="btn btn-primary" disabled={pending}>
							{pending ? 'Saving…' : 'Save connection'}
						</button>
					</div>
				{/snippet}
			</Form>
		</div>
	</section>

	<section class="panel">
		<header class="panel-header">
			<h2 class="panel-title">Railway</h2>
			{#if data.railway}
				<span class="chip {data.railway.enabled ? 'text-ok' : 'text-muted'}">
					{data.railway.enabled ? 'Collecting logs' : 'Paused'}
				</span>
			{/if}
		</header>
		<div class="panel-body">
			<p class="mb-6 text-muted">
				Stores the connection used to collect deployment logs. Log collection itself runs on a
				schedule and is not active until that job is set up.
				{#if data.railway?.lastPollError}
					<span class="mt-2 block font-semibold text-bad">Last problem: {data.railway.lastPollError}</span>
				{/if}
			</p>

			<Form action="?/railway" reset={false}>
				{#snippet children({ pending, errors })}
					<div class="grid gap-5">
						<div>
							<label class="label" for="railway_project_id">Railway project ID</label>
							<input id="railway_project_id" name="railway_project_id" class="input mono" required maxlength="100" value={data.railway?.projectId ?? ''} aria-invalid={errors.railway_project_id ? 'true' : undefined} />
							{#if errors.railway_project_id}<p class="field-error">{errors.railway_project_id}</p>{/if}
						</div>
						<div class="grid gap-5 sm:grid-cols-2">
							<div>
								<label class="label" for="railway_environment_id">Environment ID</label>
								<input id="railway_environment_id" name="railway_environment_id" class="input mono" required maxlength="100" value={data.railway?.environmentId ?? ''} aria-invalid={errors.railway_environment_id ? 'true' : undefined} />
								{#if errors.railway_environment_id}<p class="field-error">{errors.railway_environment_id}</p>{/if}
							</div>
							<div>
								<label class="label" for="railway_service_id">Service ID</label>
								<input id="railway_service_id" name="railway_service_id" class="input mono" required maxlength="100" value={data.railway?.serviceId ?? ''} aria-invalid={errors.railway_service_id ? 'true' : undefined} />
								{#if errors.railway_service_id}<p class="field-error">{errors.railway_service_id}</p>{/if}
							</div>
						</div>
						<div>
							<label class="label" for="api_token">
								API token
								{#if data.railway?.hasToken}<span class="font-normal text-muted">(leave blank to keep the saved one)</span>{/if}
							</label>
							<input id="api_token" name="api_token" type="password" class="input" autocomplete="off" maxlength="500" placeholder={data.railway?.hasToken ? '••••••••••••' : ''} aria-invalid={errors.api_token ? 'true' : undefined} />
							{#if errors.api_token}<p class="field-error">{errors.api_token}</p>{/if}
						</div>
						<label class="choice">
							<input type="checkbox" name="enabled" class="checkbox" checked={data.railway?.enabled ?? true} />
							<span class="font-semibold">Collect logs for this service</span>
						</label>
					</div>
					<div class="mt-7 flex flex-wrap justify-between gap-3">
						{#if data.railway}
							<button
								type="button"
								class="btn btn-danger"
								onclick={() => {
									disconnecting = 'railway';
									disconnectOpen = true;
								}}
							>
								Disconnect
							</button>
						{:else}
							<span></span>
						{/if}
						<button type="submit" class="btn btn-primary" disabled={pending}>
							{pending ? 'Saving…' : 'Save connection'}
						</button>
					</div>
				{/snippet}
			</Form>
		</div>
	</section>

	<section class="panel">
		<header class="panel-header"><h2 class="panel-title">Public status page</h2></header>
		<div class="panel-body">
			{#if data.statusPage}
				<p class="text-muted">
					A public status page is {data.statusPage.is_enabled ? 'enabled' : 'turned off'} for this
					project. The page itself is not built yet, so the link is not live.
				</p>
			{:else}
				<p class="text-muted">
					No public status page is set up. This is planned: a read-only page anyone can open to see
					whether the product is up.
				</p>
			{/if}
			<p class="mt-4">
				<a href="/dashboard/projects/{data.project.id}/monitoring" class="link">
					Manage monitored addresses <ExternalLink size={14} class="inline" />
				</a>
			</p>
		</div>
	</section>
</div>

<ConfirmDialog
	bind:open={disconnectOpen}
	title="Disconnect {disconnecting === 'github' ? 'GitHub' : 'Railway'}?"
	message="The connection and its token are removed. Data that was already collected stays."
	action={disconnecting === 'github' ? '?/disconnectGithub' : '?/disconnectRailway'}
	confirmLabel="Disconnect"
	note=""
/>

<script lang="ts">
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import Form from '#lib/components/Form.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { role as roleOption } from '#lib/constants.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let leaving = $state(false);
</script>

<svelte:head>
	<title>Workspace settings · {data.workspace.name}</title>
</svelte:head>

<PageHeader title="Workspace settings" description="Manage {data.workspace.name} and your other workspaces." />

<div class="grid max-w-3xl gap-8">
	{#if data.invites.length > 0}
		<section class="panel">
			<header class="panel-header"><h2 class="panel-title">Invitations waiting for you</h2></header>
			<div class="grid gap-3 p-5">
				{#each data.invites as invite (invite.id)}
					<div class="flex flex-wrap items-center gap-4 rounded-block bg-surface-2 p-4">
						<div class="min-w-0 flex-1">
							<p class="text-lg font-semibold">{invite.organization_name}</p>
							<p class="text-[0.92rem] text-muted">
								{invite.invited_by_name ? `${invite.invited_by_name} invited you` : 'You were invited'}
								as {roleOption(invite.role).label}.
							</p>
						</div>
						<Form action="?/accept">
							{#snippet children({ pending })}
								<input type="hidden" name="id" value={invite.id} />
								<button type="submit" class="btn btn-primary" disabled={pending}>Join</button>
							{/snippet}
						</Form>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	<section class="panel">
		<header class="panel-header"><h2 class="panel-title">This workspace</h2></header>
		<div class="panel-body">
			<dl class="mb-7 grid grid-cols-3 gap-3">
				<div class="rounded-block bg-surface-2 p-4">
					<dt class="eyebrow">Your role</dt>
					<dd class="mt-1.5 text-lg font-bold">{roleOption(data.workspace.role).label.replace(' (view only)', '')}</dd>
				</div>
				<div class="rounded-block bg-surface-2 p-4">
					<dt class="eyebrow">People</dt>
					<dd class="mt-1.5 text-lg font-bold tabular-nums">{data.memberCount}</dd>
				</div>
				<div class="rounded-block bg-surface-2 p-4">
					<dt class="eyebrow">Projects</dt>
					<dd class="mt-1.5 text-lg font-bold tabular-nums">{data.projectCount}</dd>
				</div>
			</dl>

			<Form action="?/rename" reset={false}>
				{#snippet children({ pending, errors })}
					<label class="label" for="workspace-name">Workspace name</label>
					<div class="flex flex-wrap gap-3">
						<input
							id="workspace-name"
							name="name"
							class="input min-w-0 flex-1"
							required
							minlength="2"
							maxlength="80"
							value={data.workspace.name}
							disabled={!data.isOwner}
							aria-invalid={errors.name ? 'true' : undefined}
						/>
						{#if data.isOwner}
							<button type="submit" class="btn btn-primary" disabled={pending}>
								{pending ? 'Saving…' : 'Save name'}
							</button>
						{/if}
					</div>
					{#if errors.name}<p class="field-error">{errors.name}</p>{/if}
					{#if !data.isOwner}<p class="hint">Only owners can rename the workspace.</p>{/if}
				{/snippet}
			</Form>
		</div>
	</section>

	<section class="panel" id="new-workspace">
		<header class="panel-header"><h2 class="panel-title">Create another workspace</h2></header>
		<div class="panel-body">
			<p class="mb-5 text-muted">
				Use a separate workspace for a different company or team. You will be its owner, and you
				can switch between workspaces from the top of the sidebar.
			</p>
			<Form action="?/create">
				{#snippet children({ pending, errors })}
					<label class="label" for="new-workspace-name">Name of the new workspace</label>
					<div class="flex flex-wrap gap-3">
						<input
							id="new-workspace-name"
							name="name"
							class="input min-w-0 flex-1"
							required
							minlength="2"
							maxlength="80"
							placeholder="For example: Acme Studio"
							aria-invalid={errors.name ? 'true' : undefined}
						/>
						<button type="submit" class="btn" disabled={pending}>
							{pending ? 'Creating…' : 'Create workspace'}
						</button>
					</div>
					{#if errors.name}<p class="field-error">{errors.name}</p>{/if}
				{/snippet}
			</Form>
		</div>
	</section>

	<section class="panel border-bad/40!">
		<header class="panel-header"><h2 class="panel-title">Leave this workspace</h2></header>
		<div class="panel-body flex flex-wrap items-center justify-between gap-4">
			<p class="max-w-prose text-muted">
				You will lose access to its projects. Nothing is deleted, and an owner can invite you back.
			</p>
			<button type="button" class="btn btn-danger" onclick={() => (leaving = true)}>
				Leave workspace
			</button>
		</div>
	</section>
</div>

<ConfirmDialog
	bind:open={leaving}
	title="Leave {data.workspace.name}?"
	message="You will lose access to every project in this workspace until an owner invites you again."
	action="?/leave"
	confirmLabel="Leave workspace"
	note="Nothing is deleted."
/>

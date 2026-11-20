<script lang="ts">
	import Mail from '@lucide/svelte/icons/mail';
	import UserPlus from '@lucide/svelte/icons/user-plus';
	import Avatar from '#lib/components/Avatar.svelte';
	import Badge from '#lib/components/Badge.svelte';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import Dialog from '#lib/components/Dialog.svelte';
	import Form from '#lib/components/Form.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { INVITE_ROLES, ROLES, role as roleOption } from '#lib/constants.ts';
	import { formatDate } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let inviting = $state(false);
	let removing = $state<{ id: string; name: string } | null>(null);
	let removeOpen = $state(false);
	let revoking = $state<{ id: string; email: string } | null>(null);
	let revokeOpen = $state(false);
</script>

<svelte:head>
	<title>People · {data.workspace.name}</title>
</svelte:head>

<PageHeader title="People" description="Everyone who can open {data.workspace.name}.">
	{#if data.isOwner}
		<button type="button" class="btn btn-primary" onclick={() => (inviting = true)}>
			<UserPlus size={20} /> Invite someone
		</button>
	{/if}
</PageHeader>

<div class="list">
	{#each data.members as member (member.id)}
		<div class="list-row flex-wrap">
			<Avatar name={member.name} src={member.avatarUrl} size={52} />
			<div class="min-w-0 flex-1">
				<p class="truncate text-lg font-semibold">
					{member.name}
					{#if member.id === data.me.id}<span class="chip ml-1 text-muted">You</span>{/if}
				</p>
				<p class="truncate text-[0.9rem] text-muted">
					{member.username ? `@${member.username} · ` : ''}{member.email}
				</p>
			</div>

			{#if data.isOwner && member.id !== data.me.id}
				<Form action="?/role" class="flex items-center gap-2">
					{#snippet children({ pending })}
						<input type="hidden" name="user_id" value={member.id} />
						<label class="sr-only" for="role-{member.id}">Role for {member.name}</label>
						<select
							id="role-{member.id}"
							name="role"
							class="select min-h-10! w-auto py-1.5!"
							disabled={pending}
							onchange={(event) => event.currentTarget.form?.requestSubmit()}
						>
							{#each ROLES as option (option.value)}
								<option value={option.value} selected={option.value === member.role}>
									{option.label}
								</option>
							{/each}
						</select>
					{/snippet}
				</Form>
				<button
					type="button"
					class="btn btn-danger btn-sm"
					onclick={() => {
						removing = { id: member.id, name: member.name };
						removeOpen = true;
					}}
				>
					Remove
				</button>
			{:else}
				<Badge label={roleOption(member.role).label} />
			{/if}
		</div>
	{/each}
</div>

<section class="panel mt-8 p-6 sm:p-7">
	<h2 class="text-xl">What each role can do</h2>
	<dl class="mt-4 grid gap-4 sm:grid-cols-3">
		<div class="rounded-block bg-surface-2 p-4">
			<dt class="font-bold">Owner</dt>
			<dd class="mt-1 text-[0.93rem] text-muted">Everything, including inviting people and changing roles.</dd>
		</div>
		<div class="rounded-block bg-surface-2 p-4">
			<dt class="font-bold">Developer</dt>
			<dd class="mt-1 text-[0.93rem] text-muted">Create and change projects, tasks and everything inside them.</dd>
		</div>
		<div class="rounded-block bg-surface-2 p-4">
			<dt class="font-bold">Client</dt>
			<dd class="mt-1 text-[0.93rem] text-muted">Look at projects and add comments. Cannot change anything else.</dd>
		</div>
	</dl>
</section>

{#if data.isOwner}
	<section class="mt-10">
		<h2 class="mb-5 text-2xl">Open invitations</h2>
		{#if data.invites.length === 0}
			<p class="rounded-block-lg border-2 border-dashed border-line px-6 py-8 text-center text-muted">
				No open invitations.
			</p>
		{:else}
			<div class="list">
				{#each data.invites as invite (invite.id)}
					<div class="list-row flex-wrap">
						<span class="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-2">
							<Mail size={21} class="text-muted" />
						</span>
						<div class="min-w-0 flex-1">
							<p class="truncate font-semibold">{invite.email}</p>
							<p class="text-[0.9rem] text-muted">
								Invited as {roleOption(invite.role).label} · valid until {formatDate(invite.expires_at)}
							</p>
						</div>
						<button
							type="button"
							class="btn btn-sm"
							onclick={() => {
								revoking = { id: invite.id, email: invite.email };
								revokeOpen = true;
							}}
						>
							Cancel invitation
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<Dialog bind:open={inviting} title="Invite someone">
		<Form action="?/invite" onsuccess={() => (inviting = false)}>
			{#snippet children({ pending, errors })}
				<div class="grid gap-5">
					<div>
						<label class="label" for="invite-email">Their email address</label>
						<input
							id="invite-email"
							name="email"
							type="email"
							class="input"
							required
							autocomplete="off"
							aria-invalid={errors.email ? 'true' : undefined}
						/>
						{#if errors.email}<p class="field-error">{errors.email}</p>{/if}
					</div>
					<fieldset>
						<legend class="label">Role</legend>
						<div class="grid gap-3">
							{#each INVITE_ROLES as option, i (option.value)}
								<label class="choice">
									<input type="radio" name="role" value={option.value} class="checkbox" checked={i === 0} />
									<span class="font-semibold">{option.label}</span>
								</label>
							{/each}
						</div>
						{#if errors.role}<p class="field-error">{errors.role}</p>{/if}
					</fieldset>
					<p class="notice">
						No email is sent yet. Ask them to sign up or log in with this email address: the
						invitation will be waiting for them. It stays valid for 14 days.
					</p>
				</div>
				<div class="mt-8 flex flex-wrap justify-end gap-3">
					<button type="button" class="btn" onclick={() => (inviting = false)}>Cancel</button>
					<button type="submit" class="btn btn-primary" disabled={pending}>
						{pending ? 'Creating…' : 'Create invitation'}
					</button>
				</div>
			{/snippet}
		</Form>
	</Dialog>

	<ConfirmDialog
		bind:open={removeOpen}
		title="Remove {removing?.name ?? 'this person'}?"
		message="They will lose access to every project in this workspace. You can invite them again later."
		action="?/remove"
		values={{ id: removing?.id ?? '' }}
		confirmLabel="Remove"
	/>
	<ConfirmDialog
		bind:open={revokeOpen}
		title="Cancel this invitation?"
		message={`${revoking?.email ?? 'This person'} will no longer be able to join with it.`}
		action="?/revoke"
		values={{ id: revoking?.id ?? '' }}
		confirmLabel="Cancel invitation"
	/>
{/if}

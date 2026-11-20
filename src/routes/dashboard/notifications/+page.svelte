<script lang="ts">
	import Bell from '@lucide/svelte/icons/bell';
	import CheckCheck from '@lucide/svelte/icons/check-check';
	import Trash from '@lucide/svelte/icons/trash';
	import X from '@lucide/svelte/icons/x';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Form from '#lib/components/Form.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Time from '#lib/components/Time.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const unread = $derived(data.notifications.filter((item) => !item.read_at).length);
	const read = $derived(data.notifications.length - unread);
	let clearing = $state(false);
</script>

<svelte:head>
	<title>Notifications · {data.workspace.name}</title>
</svelte:head>

<PageHeader
	title="Notifications"
	description={unread > 0 ? `You have ${unread} unread.` : 'You are all caught up.'}
>
	{#if unread > 0}
		<Form action="?/readAll">
			{#snippet children({ pending })}
				<button type="submit" class="btn" disabled={pending}>
					<CheckCheck size={19} /> Mark all as read
				</button>
			{/snippet}
		</Form>
	{/if}
	{#if read > 0}
		<button type="button" class="btn btn-ghost" onclick={() => (clearing = true)}>
			<Trash size={18} /> Clear read
		</button>
	{/if}
</PageHeader>

{#if data.notifications.length === 0}
	<EmptyState
		title="No notifications"
		message="You will be told here when someone assigns you a task, comments on your work or invites you somewhere."
	/>
{:else}
	<div class="list">
		{#each data.notifications as item (item.id)}
			<div class="list-row items-start! {item.read_at ? '' : 'bg-surface-2'}">
				<span
					class="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-block {item.read_at
						? 'bg-surface-2 text-muted'
						: 'bg-accent text-accent-fg'}"
					aria-hidden="true"
				>
					<Bell size={20} />
				</span>
				<div class="min-w-0 flex-1">
					<p class="font-semibold">
						{#if !item.read_at}<span class="sr-only">Unread: </span>{/if}
						{#if item.link.startsWith('/')}
							<a href={item.link} class="link">{item.title}</a>
						{:else}
							{item.title}
						{/if}
					</p>
					{#if item.body}<p class="mt-1 line-clamp-3 text-muted">{item.body}</p>{/if}
					<p class="mt-1 text-[0.88rem] text-faint"><Time value={item.created_at} relative /></p>
				</div>
				<div class="flex shrink-0 gap-1.5">
					{#if !item.read_at}
						<Form action="?/read" toast={false}>
							{#snippet children({ pending })}
								<input type="hidden" name="id" value={item.id} />
								<button type="submit" class="btn btn-sm" disabled={pending}>Mark as read</button>
							{/snippet}
						</Form>
					{/if}
					<Form action="?/delete" toast={false}>
						{#snippet children({ pending })}
							<input type="hidden" name="id" value={item.id} />
							<button
								type="submit"
								class="btn btn-ghost btn-sm btn-icon"
								aria-label="Remove notification"
								title="Remove"
								disabled={pending}
							>
								<X size={17} />
							</button>
						{/snippet}
					</Form>
				</div>
			</div>
		{/each}
	</div>
{/if}

<ConfirmDialog
	bind:open={clearing}
	title="Clear read notifications?"
	message="All notifications you have already read will be removed. Unread ones stay."
	action="?/clear"
	confirmLabel="Clear"
/>

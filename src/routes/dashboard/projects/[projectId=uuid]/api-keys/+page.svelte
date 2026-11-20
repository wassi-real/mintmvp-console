<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Copy from '@lucide/svelte/icons/copy';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash from '@lucide/svelte/icons/trash';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import Dialog from '#lib/components/Dialog.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Form from '#lib/components/Form.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Time from '#lib/components/Time.svelte';
	import { toasts } from '#lib/toast.svelte.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let creating = $state(false);
	let revealed = $state('');
	let copied = $state(false);
	let revoking = $state<{ id: string; name: string } | null>(null);
	let revokeOpen = $state(false);

	// The full key comes back once, inside the action result, and is never stored.
	$effect(() => {
		const key = form && 'key' in form ? String(form.key ?? '') : '';
		if (key) {
			revealed = key;
			creating = false;
			copied = false;
		}
	});

	async function copy() {
		try {
			await navigator.clipboard.writeText(revealed);
			copied = true;
			toasts.show('Key copied.');
		} catch {
			toasts.show('Could not copy. Select the key and copy it by hand.', 'bad');
		}
	}
</script>

<svelte:head>
	<title>API keys · {data.project.name}</title>
</svelte:head>

<PageHeader
	title="API keys"
	description="Keys let your tools and agents add reports and read this project. A key is shown in full only once, when you create it."
>
	<button type="button" class="btn btn-primary" onclick={() => (creating = true)}>
		<Plus size={20} /> New API key
	</button>
</PageHeader>

{#if revealed}
	<section class="notice notice-ok mb-8">
		<p class="font-semibold">Copy your new key now. It will not be shown again.</p>
		<div class="mt-3 flex flex-wrap gap-3">
			<code class="mono min-w-0 flex-1 rounded-block bg-bg px-4 py-3 break-all select-all">{revealed}</code>
			<button type="button" class="btn" onclick={copy}>
				{#if copied}<Check size={18} /> Copied{:else}<Copy size={18} /> Copy{/if}
			</button>
		</div>
		<button type="button" class="btn btn-ghost btn-sm mt-3 -ml-2" onclick={() => (revealed = '')}>
			I have saved it
		</button>
	</section>
{/if}

{#if data.keys.length === 0}
	<EmptyState title="No API keys" message="Create a key when a tool or agent needs access to this project.">
		<button type="button" class="btn btn-primary" onclick={() => (creating = true)}>
			<Plus size={20} /> New API key
		</button>
	</EmptyState>
{:else}
	<div class="list">
		{#each data.keys as key (key.id)}
			<div class="list-row flex-wrap">
				<span class="flex size-12 shrink-0 items-center justify-center rounded-block bg-surface-2 text-muted" aria-hidden="true">
					<KeyRound size={21} />
				</span>
				<div class="min-w-64 flex-1">
					<p class="font-semibold">{key.name}</p>
					<p class="mono text-[0.9rem] text-muted">{key.key_prefix}…</p>
				</div>
				<div class="text-[0.9rem] text-muted">
					<p>Created by {key.created_by || 'unknown'} · <Time value={key.created_at} relative /></p>
					<p>Last used <Time value={key.last_used_at} relative fallback="never" /></p>
				</div>
				<button
					type="button"
					class="btn btn-danger btn-sm"
					onclick={() => {
						revoking = { id: key.id, name: key.name };
						revokeOpen = true;
					}}
				>
					<Trash size={16} /> Revoke
				</button>
			</div>
		{/each}
	</div>
{/if}

<Dialog bind:open={creating} title="New API key">
	<Form action="?/create" reset={false}>
		{#snippet children({ pending, errors })}
			<label class="label" for="key-name">Name</label>
			<input
				id="key-name"
				name="name"
				class="input"
				required
				minlength="2"
				maxlength="80"
				placeholder="For example: Report bot"
				aria-invalid={errors.name ? 'true' : undefined}
			/>
			{#if errors.name}<p class="field-error">{errors.name}</p>{/if}
			<p class="hint">A name so you can tell later which tool uses this key.</p>
			<div class="mt-8 flex flex-wrap justify-end gap-3">
				<button type="button" class="btn" onclick={() => (creating = false)}>Cancel</button>
				<button type="submit" class="btn btn-primary" disabled={pending}>
					{pending ? 'Creating…' : 'Create key'}
				</button>
			</div>
		{/snippet}
	</Form>
</Dialog>

<ConfirmDialog
	bind:open={revokeOpen}
	title="Revoke this API key?"
	message={`“${revoking?.name ?? 'This key'}” will stop working immediately. Anything using it will lose access.`}
	values={{ id: revoking?.id ?? '' }}
	confirmLabel="Revoke key"
/>

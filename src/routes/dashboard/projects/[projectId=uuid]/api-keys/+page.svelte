<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Copy from '@lucide/svelte/icons/copy';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash from '@lucide/svelte/icons/trash';
	import { agentPrompt } from '#lib/agent-prompt.ts';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import Dialog from '#lib/components/Dialog.svelte';
	import Form from '#lib/components/Form.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Time from '#lib/components/Time.svelte';
	import { formatLimit } from '#lib/plans.ts';
	import { toasts } from '#lib/toast.svelte.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let creating = $state(false);
	let revealed = $state('');
	let copied = $state<'key' | 'prompt' | ''>('');
	let revoking = $state<{ id: string; name: string } | null>(null);
	let revokeOpen = $state(false);

	// The full key comes back once, inside the action result, and is never stored.
	$effect(() => {
		const key = form && 'key' in form ? String(form.key ?? '') : '';
		if (key) {
			revealed = key;
			creating = false;
			copied = '';
		}
	});

	const prompt = $derived(
		agentPrompt({ project: data.project.name, apiBase: data.apiBase, docsUrl: data.docsUrl, key: revealed })
	);
	const writesLeft = $derived(Math.max(data.limits.apiWritesPerMonth - data.usage.writes, 0));

	async function copy(what: 'key' | 'prompt') {
		try {
			await navigator.clipboard.writeText(what === 'key' ? revealed : prompt);
			copied = what;
			toasts.show(what === 'key' ? 'Key copied.' : 'Prompt copied. Paste it into your agent.');
		} catch {
			toasts.show('Could not copy. Select the text and copy it by hand.', 'bad');
		}
	}
</script>

<svelte:head>
	<title>Connect agent · {data.project.name}</title>
</svelte:head>

<PageHeader
	title="Connect agent"
	description="Give Claude Code, Cursor, Codex or any agent a key. It reads the approved plans, claims work, and posts its checks here."
>
	<button type="button" class="btn btn-primary" onclick={() => (creating = true)}>
		<Plus size={20} /> New key
	</button>
</PageHeader>

<ol class="mb-10 grid gap-4 md:grid-cols-3">
	<li class="tile p-5">
		<p class="eyebrow">Step 1</p>
		<p class="mt-1 font-semibold">Create a key</p>
		<p class="mt-1 text-muted">One per agent or machine, so you can revoke one without stopping the rest.</p>
	</li>
	<li class="tile p-5">
		<p class="eyebrow">Step 2</p>
		<p class="mt-1 font-semibold">Paste the prompt</p>
		<p class="mt-1 text-muted">Copy it below into your agent's rules or first message. The key is filled in for you.</p>
	</li>
	<li class="tile p-5">
		<p class="eyebrow">Step 3</p>
		<p class="mt-1 font-semibold">Approve its plans</p>
		<p class="mt-1 text-muted">You decide on the Today page. The agent does everything else.</p>
	</li>
</ol>

{#if revealed}
	<section class="notice notice-ok mb-8">
		<p class="font-semibold">Copy your new key now. It will not be shown again.</p>
		<div class="mt-3 flex flex-wrap gap-3">
			<code class="mono min-w-0 flex-1 rounded-block bg-bg px-4 py-3 break-all select-all">{revealed}</code>
			<button type="button" class="btn" onclick={() => copy('key')}>
				{#if copied === 'key'}<Check size={18} /> Copied{:else}<Copy size={18} /> Copy key{/if}
			</button>
		</div>
		<button type="button" class="btn btn-ghost btn-sm mt-3 -ml-2" onclick={() => (revealed = '')}>
			I have saved it
		</button>
	</section>
{/if}

<section class="panel mb-10">
	<div class="panel-header flex flex-wrap items-center justify-between gap-3">
		<h2 class="panel-title">Agent prompt</h2>
		<button type="button" class="btn btn-sm {revealed ? 'btn-primary' : ''}" onclick={() => copy('prompt')}>
			{#if copied === 'prompt'}<Check size={16} /> Copied{:else}<Copy size={16} /> Copy prompt{/if}
		</button>
	</div>
	<pre class="panel-body mono max-h-96 overflow-auto text-[0.85rem] leading-relaxed whitespace-pre-wrap">{prompt}</pre>
	<p class="px-6 pb-5 text-[0.9rem] text-muted">
		Every endpoint, field and error is in the <a class="link" href="/docs">API docs</a>.
	</p>
</section>

<section class="mb-10 grid gap-4 sm:grid-cols-3">
	<div class="tile p-5">
		<p class="eyebrow">Per key</p>
		<p class="mt-1 text-2xl font-bold tabular-nums">{data.limits.apiPerMinute}</p>
		<p class="text-muted">requests a minute</p>
	</div>
	<div class="tile p-5">
		<p class="eyebrow">Writes this month</p>
		<p class="mt-1 text-2xl font-bold tabular-nums">
			{data.usage.writes.toLocaleString('en-US')}
			<span class="text-base font-normal text-muted">of {formatLimit(data.limits.apiWritesPerMonth)}</span>
		</p>
		<p class="text-muted">{writesLeft.toLocaleString('en-US')} left. Reads are not capped.</p>
	</div>
	<div class="tile p-5">
		<p class="eyebrow">Plan</p>
		<p class="mt-1 text-2xl font-bold">{data.limits.name}</p>
		<p class="text-muted">
			Limits follow the workspace owner's plan. <a class="link" href="/dashboard/billing">See plans</a>
		</p>
	</div>
</section>

<h2 class="mb-4 text-xl">Keys</h2>
{#if data.keys.length === 0}
	<p class="tile p-5 text-muted">No keys yet. Create one to connect your first agent.</p>
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

<Dialog bind:open={creating} title="New agent key">
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
				placeholder="For example: Claude Code on my laptop"
				aria-invalid={errors.name ? 'true' : undefined}
			/>
			{#if errors.name}<p class="field-error">{errors.name}</p>{/if}
			<p class="hint">The key can read and change this project only. Agents show up under this name unless they send X-Agent-Name.</p>
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
	title="Revoke this key?"
	message={`“${revoking?.name ?? 'This key'}” will stop working immediately. Any agent using it will lose access.`}
	values={{ id: revoking?.id ?? '' }}
	confirmLabel="Revoke key"
/>

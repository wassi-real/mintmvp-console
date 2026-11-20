<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import Send from '@lucide/svelte/icons/send';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import X from '@lucide/svelte/icons/x';
	import { fly } from 'svelte/transition';

	interface Chat {
		id: string;
		title: string;
		updated_at: string;
	}
	interface Message {
		id: string;
		role: 'user' | 'assistant';
		content: string;
		created_at: string;
	}
	interface State {
		ready: boolean;
		premium: boolean;
		used: number;
		remaining: number;
		configured: boolean;
		chats: Chat[];
		chatId: string | null;
		messages: Message[];
	}

	interface Props {
		projectId: string;
		projectName: string;
	}

	let { projectId, projectName }: Props = $props();

	let open = $state(false);
	let loaded = $state(false);
	let loading = $state(false);
	let sending = $state(false);
	let fresh = $state(false);
	let draft = $state('');
	let notice = $state('');
	let panel = $state<State | null>(null);
	let scroller = $state<HTMLElement>();

	const endpoint = $derived(`/dashboard/projects/${projectId}/ai`);

	async function load(chatId?: string) {
		loading = true;
		notice = '';
		fresh = false;
		try {
			const response = await fetch(chatId ? `${endpoint}?chat=${chatId}` : endpoint);
			if (!response.ok) {
				notice = 'MintAI could not be opened. Please refresh and try again.';
				return;
			}
			panel = (await response.json()) as State;
			loaded = true;
			queueMicrotask(() => scroller?.scrollTo({ top: scroller.scrollHeight }));
		} catch {
			notice = 'MintAI could not be opened. Check your connection and try again.';
		} finally {
			loading = false;
		}
	}

	async function toggle() {
		open = !open;
		if (open && !loaded) await load();
	}

	function newChat() {
		fresh = true;
		notice = '';
		if (panel) panel = { ...panel, chatId: null, messages: [] };
	}

	async function send() {
		const message = draft.trim();
		if (!message || sending || !panel?.premium) return;
		const startNew = fresh || !panel.chatId;
		sending = true;
		notice = '';
		draft = '';
		fresh = false;
		const optimistic: Message = {
			id: `local-${Date.now()}`,
			role: 'user',
			content: message,
			created_at: new Date().toISOString()
		};
		panel = panel
			? { ...panel, messages: [...panel.messages, optimistic] }
			: panel;
		queueMicrotask(() => scroller?.scrollTo({ top: scroller.scrollHeight }));
		try {
			const response = await fetch(endpoint, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					message,
					chatId: startNew ? undefined : panel?.chatId,
					newChat: startNew
				})
			});
			const payload = (await response.json().catch(() => null)) as {
				message?: string;
				reply?: string;
				chatId?: string;
				remaining?: number;
			} | null;
			if (!response.ok || !payload?.reply) {
				notice = payload?.message || 'MintAI could not answer. Please try again.';
				return;
			}
			await load(payload.chatId);
		} catch {
			notice = 'MintAI could not answer. Check your connection and try again.';
		} finally {
			sending = false;
		}
	}
</script>

<button
	type="button"
	class="btn btn-primary fixed right-5 bottom-5 z-40 shadow-(--shadow) sm:right-8 sm:bottom-8"
	aria-expanded={open}
	onclick={toggle}
>
	<Sparkles size={18} /> MintAI
</button>

{#if open}
	<section
		class="fixed right-5 bottom-24 z-40 flex h-[min(38rem,calc(100dvh-8rem))] w-[min(26rem,calc(100vw-2.5rem))] flex-col overflow-hidden rounded-block-xl border border-line bg-surface shadow-(--shadow) sm:right-8"
		aria-label="MintAI for {projectName}"
		transition:fly={{ y: 16, duration: 220 }}
	>
		<header class="flex items-center gap-3 border-b border-line px-4 py-3">
			<span class="flex size-10 items-center justify-center rounded-block bg-accent text-accent-fg">
				<Sparkles size={18} />
			</span>
			<div class="min-w-0 flex-1">
				<p class="font-bold">MintAI</p>
				<p class="truncate text-[0.85rem] text-muted">
					{#if panel?.premium}
						{panel.remaining} of 100 requests left · {projectName}
					{:else}
						Premium · {projectName}
					{/if}
				</p>
			</div>
			{#if panel?.premium}
				<button type="button" class="btn btn-ghost btn-sm btn-icon" title="New chat" aria-label="New chat" onclick={newChat} disabled={sending}>
					<Plus size={18} />
				</button>
			{/if}
			<button type="button" class="btn btn-ghost btn-sm btn-icon" aria-label="Close MintAI" onclick={() => (open = false)}>
				<X size={18} />
			</button>
		</header>

		{#if panel && panel.chats.length > 1}
			<div class="flex gap-2 overflow-x-auto border-b border-line px-3 py-2">
				{#each panel.chats as chat (chat.id)}
					<button
						type="button"
						class="chip shrink-0 {chat.id === panel.chatId ? 'bg-accent text-accent-fg' : ''}"
						onclick={() => load(chat.id)}
					>
						{chat.title}
					</button>
				{/each}
			</div>
		{/if}

		<div class="min-h-0 flex-1 overflow-y-auto px-4 py-4" bind:this={scroller}>
			{#if loading && !panel}
				<p class="text-muted">Opening MintAI…</p>
			{:else if panel && !panel.ready}
				<p class="notice notice-warn">MintAI storage is not ready yet. Apply the latest database migration, then refresh.</p>
			{:else if panel && !panel.premium}
				<div class="grid gap-4">
					<p>MintAI can create, edit and delete work in <strong>{projectName}</strong>, and it remembers this project’s chats.</p>
					<p class="text-muted">It is part of Premium, which is $5 a month. Free accounts cannot use it.</p>
					<a href="/dashboard/billing" class="btn btn-primary">See Premium</a>
				</div>
			{:else if panel && !panel.configured}
				<p class="notice">MintAI is waiting for an Anthropic API key on the server.</p>
			{:else if panel && panel.messages.length === 0}
				<p class="text-muted">
					Ask MintAI to add a task, update a milestone, write a spec or clean up this project. It only works inside {projectName}.
				</p>
			{:else if panel}
				<div class="grid gap-3">
					{#each panel.messages as message (message.id)}
						<div class="max-w-[95%] rounded-block px-3.5 py-2.5 whitespace-pre-wrap {message.role === 'user' ? 'ml-auto bg-accent text-accent-fg' : 'bg-surface-2'}">
							{message.content}
						</div>
					{/each}
					{#if sending}<p class="text-[0.9rem] text-muted">MintAI is working…</p>{/if}
				</div>
			{/if}
			{#if notice}<p class="notice notice-bad mt-4" role="alert">{notice}</p>{/if}
		</div>

		<form
			class="border-t border-line p-3"
			onsubmit={(event) => {
				event.preventDefault();
				send();
			}}
		>
			<label class="sr-only" for="mintai-draft">Message MintAI</label>
			<div class="flex gap-2">
				<textarea
					id="mintai-draft"
					class="textarea min-h-12! flex-1"
					rows="2"
					maxlength="4000"
					placeholder={panel?.premium ? 'Ask MintAI…' : 'Premium is required'}
					bind:value={draft}
					disabled={!panel?.premium || sending}
					onkeydown={(event) => {
						if (event.key === 'Enter' && !event.shiftKey) {
							event.preventDefault();
							send();
						}
					}}
				></textarea>
				<button type="submit" class="btn btn-primary btn-icon self-end" aria-label="Send" disabled={!panel?.premium || sending || !draft.trim()}>
					<Send size={18} />
				</button>
			</div>
		</form>
	</section>
{/if}

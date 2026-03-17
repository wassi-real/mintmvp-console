<script lang="ts">
	import type { Snippet } from 'svelte';
	import { X } from 'lucide-svelte';

	let {
		open = $bindable(false),
		title,
		children
	}: {
		open: boolean;
		title: string;
		children: Snippet;
	} = $props();

	function close() {
		open = false;
	}

	function onBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) close();
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') close();
	}
</script>

<svelte:window onkeydown={onKeydown} />

{#if open}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		role="presentation"
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
		onclick={onBackdropClick}
	>
		<!-- Panel -->
		<div
			class="relative w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl"
			role="dialog"
			aria-modal="true"
			aria-labelledby="modal-title"
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-border px-6 py-5">
				<h2 id="modal-title" class="text-xl font-semibold text-foreground">{title}</h2>
				<button
					onclick={close}
					class="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
					aria-label="Close"
				>
					<X size={20} />
				</button>
			</div>

			<!-- Content -->
			<div class="px-6 py-6">
				{@render children()}
			</div>
		</div>
	</div>
{/if}

<script lang="ts">
	import type { Snippet } from 'svelte';
	import X from '@lucide/svelte/icons/x';

	interface Props {
		open: boolean;
		title: string;
		children: Snippet;
		size?: 'sm' | 'md' | 'lg';
	}

	let { open = $bindable(false), title, children, size = 'md' }: Props = $props();

	let element = $state<HTMLDialogElement>();
	const titleId = $props.id();

	$effect(() => {
		if (!element) return;
		if (open && !element.open) element.showModal();
		if (!open && element.open) element.close();
	});

	const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };
</script>

<!-- The native <dialog> gives focus trapping and Escape-to-close. Clicking the backdrop closes it. -->
<dialog
	bind:this={element}
	aria-labelledby={titleId}
	class="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-hidden rounded-block-xl border border-line bg-surface p-0 text-fg shadow-(--shadow) {widths[
		size
	]}"
	onclose={() => (open = false)}
	onclick={(event) => {
		if (event.target === element) open = false;
	}}
>
	{#if open}
		<div class="flex max-h-[calc(100dvh-2rem)] flex-col">
			<header class="flex items-center justify-between gap-4 border-b border-line px-6 py-4 sm:px-7">
				<h2 id={titleId} class="text-xl">{title}</h2>
				<button
					type="button"
					class="btn btn-sm btn-icon rounded-full"
					aria-label="Close"
					onclick={() => (open = false)}
				>
					<X size={20} />
				</button>
			</header>
			<div class="overflow-y-auto px-6 py-6 sm:px-7">
				{@render children()}
			</div>
		</div>
	{/if}
</dialog>

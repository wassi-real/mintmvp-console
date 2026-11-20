<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';

	interface Props {
		/** The button that opens the menu. Call toggle from its onclick. */
		trigger: Snippet<[{ open: boolean; toggle: () => void }]>;
		children: Snippet;
		/** Where the menu appears relative to the button. */
		placement?: 'below' | 'above';
		class?: string;
	}

	let { trigger, children, placement = 'below', class: className = '' }: Props = $props();

	let open = $state(false);
	let root = $state<HTMLElement>();

	// Close after moving to another page.
	$effect(() => {
		void page.url.href;
		open = false;
	});
</script>

<svelte:window
	onclick={(event) => {
		if (open && root && !root.contains(event.target as Node)) open = false;
	}}
	onkeydown={(event) => {
		if (event.key === 'Escape') open = false;
	}}
/>

<div class="relative {className}" bind:this={root}>
	{@render trigger({ open, toggle: () => (open = !open) })}
	{#if open}
		<div
			class="absolute left-0 z-40 w-max max-w-[min(22rem,calc(100vw-2rem))] min-w-full animate-pop rounded-block-lg border border-line bg-surface-2 p-2 shadow-(--shadow) {placement ===
			'above'
				? 'bottom-full mb-2 origin-bottom-left'
				: 'top-full mt-2 origin-top-left'}"
		>
			{@render children()}
		</div>
	{/if}
</div>

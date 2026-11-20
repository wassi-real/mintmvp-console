<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		message?: string;
		/** Buttons or links that let the person fix the empty state. */
		children?: Snippet;
	}

	let { title, message, children }: Props = $props();
</script>

<div class="rounded-block-lg border-2 border-dashed border-line bg-surface px-6 py-14 text-center">
	<p class="text-xl font-bold tracking-tight">{title}</p>
	{#if message}
		<p class="mx-auto mt-2 max-w-prose text-muted">{message}</p>
	{/if}
	{#if children}
		<div class="mt-7 flex flex-wrap justify-center gap-3">
			{@render children()}
		</div>
	{/if}
</div>

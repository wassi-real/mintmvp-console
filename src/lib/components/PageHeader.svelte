<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		description?: string;
		/** Primary actions, shown on the right. */
		children?: Snippet;
	}

	let { title, description, children }: Props = $props();
</script>

<header class="mb-8 flex flex-wrap items-start justify-between gap-5">
	<div class="min-w-0">
		<h1 class="text-3xl sm:text-[2.1rem]">{title}</h1>
		{#if description}
			<p class="mt-2 max-w-prose text-lg text-muted">{description}</p>
		{/if}
	</div>
	{#if children}
		<div class="flex flex-wrap items-center gap-3">
			{@render children()}
		</div>
	{/if}
</header>

<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		description?: string;
		children: Snippet;
		/** Links shown under the card. */
		footer?: Snippet;
		wide?: boolean;
	}

	let { title, description, children, footer, wide = false }: Props = $props();
</script>

<main class="flex min-h-dvh flex-col items-center justify-center px-4 py-12 sm:py-16">
	<a
		href="/"
		class="flex animate-fade items-center gap-3.5 no-underline"
		aria-label="MintMVP Console home"
	>
		<img src="/logo-64.png" alt="" width="48" height="48" class="size-12 rounded-block" />
		<span class="text-xl font-bold tracking-tight">MintMVP Console</span>
	</a>

	<div
		class="mt-9 w-full animate-rise rounded-block-xl border border-line bg-surface p-7 sm:p-10 {wide
			? 'max-w-2xl'
			: 'max-w-[30rem]'}"
	>
		<h1 class="text-3xl">{title}</h1>
		{#if description}
			<p class="mt-2.5 text-lg text-muted">{description}</p>
		{/if}
		<div class="mt-8">
			{@render children()}
		</div>
	</div>

	{#if footer}
		<div class="mt-7 animate-fade text-center text-muted">
			{@render footer()}
		</div>
	{/if}
</main>

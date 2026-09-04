<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * Sticky page header for project sub-pages.
	 *
	 * The negative margins cancel the padding on the layout's scroll pane so the header's
	 * background and border span the full width while content keeps its normal gutters.
	 */
	let {
		title,
		description,
		meta,
		actions
	}: {
		title: string;
		description?: string;
		/** Small line under the title — badges, live indicators, counts. */
		meta?: Snippet;
		actions?: Snippet;
	} = $props();
</script>

<div
	class="sticky top-0 z-10 -mx-4 -mt-4 mb-6 border-b border-border/60 bg-background/85 px-4 pb-4 pt-4 backdrop-blur-xl sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-6 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-8"
>
	<div class="flex flex-wrap items-start justify-between gap-3">
		<div class="min-w-0">
			<h1 class="truncate text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
				{title}
			</h1>
			{#if meta}
				<div class="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
					{@render meta()}
				</div>
			{:else if description}
				<p class="mt-1 text-sm text-muted-foreground">{description}</p>
			{/if}
		</div>

		{#if actions}
			<div class="flex flex-wrap items-center gap-2">
				{@render actions()}
			</div>
		{/if}
	</div>
</div>

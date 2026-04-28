<script lang="ts">
	import Markdown from '$lib/components/Markdown.svelte';

	let {
		description,
		entryGate,
		exitGate
	}: {
		description?: string | null;
		entryGate?: string | null;
		exitGate?: string | null;
	} = $props();

	const hasAny = $derived(
		Boolean(description?.trim()) ||
			Boolean(entryGate?.trim()) ||
			Boolean(exitGate?.trim())
	);
</script>

{#if hasAny}
	<div class="mb-3 space-y-1.5 border-l-2 border-border pl-3 text-[11px] leading-snug text-muted-foreground">
		{#if description?.trim()}
			<details class="group">
				<summary
					class="cursor-pointer list-none text-foreground/90 [&::-webkit-details-marker]:hidden"
				>
					<span class="underline decoration-border underline-offset-2 hover:text-foreground"
						>Description</span
					>
				</summary>
				<div class="mt-1.5 max-h-28 overflow-y-auto border-l border-border/80 pl-2">
					<div class="text-muted-foreground [&_p]:my-1 [&_p:first-child]:mt-0">
						<Markdown content={description} />
					</div>
				</div>
			</details>
		{/if}
		{#if entryGate?.trim()}
			<p class="whitespace-pre-wrap">
				<span class="font-medium text-foreground/85">Entry</span>
				<span class="text-muted-foreground"> — </span>{entryGate}
			</p>
		{/if}
		{#if exitGate?.trim()}
			<p class="whitespace-pre-wrap">
				<span class="font-medium text-foreground/85">Exit</span>
				<span class="text-muted-foreground"> — </span>{exitGate}
			</p>
		{/if}
	</div>
{/if}

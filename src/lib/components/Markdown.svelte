<script lang="ts">
	import { marked } from 'marked';

	let { content = '' }: { content: string | null } = $props();

	marked.setOptions({
		breaks: true,
		gfm: true
	});

	const rendered = $derived(content ? marked.parse(content) : '');
</script>

{#if rendered}
	<div class="prose prose-invert prose-sm max-w-none">
		{@html rendered}
	</div>
{/if}

<style>
	.prose :global(h1) { font-size: 1.5rem; font-weight: 700; margin: 0.75rem 0 0.5rem; color: var(--foreground, #fafafa); }
	.prose :global(h2) { font-size: 1.25rem; font-weight: 700; margin: 0.6rem 0 0.4rem; color: var(--foreground, #fafafa); }
	.prose :global(h3) { font-size: 1.1rem; font-weight: 600; margin: 0.5rem 0 0.3rem; color: var(--foreground, #fafafa); }
	.prose :global(p) { margin: 0.4rem 0; line-height: 1.6; }
	.prose :global(ul), .prose :global(ol) { margin: 0.4rem 0; padding-left: 1.5rem; }
	.prose :global(li) { margin: 0.15rem 0; }
	.prose :global(li::marker) { color: #71717a; }
	.prose :global(code) {
		padding: 0.15rem 0.35rem;
		border-radius: 4px;
		background: rgba(39, 39, 42, 0.8);
		font-size: 0.85em;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
	}
	.prose :global(pre) {
		margin: 0.5rem 0;
		padding: 0.75rem 1rem;
		border-radius: 8px;
		background: rgba(39, 39, 42, 0.8);
		overflow-x: auto;
		font-size: 0.85rem;
	}
	.prose :global(pre code) { padding: 0; background: none; }
	.prose :global(blockquote) {
		margin: 0.5rem 0;
		padding: 0.25rem 0.75rem;
		border-left: 3px solid #3f3f46;
		color: #a1a1aa;
	}
	.prose :global(a) { color: #a78bfa; text-decoration: underline; }
	.prose :global(strong) { color: var(--foreground, #fafafa); }
	.prose :global(hr) { border-color: #27272a; margin: 0.75rem 0; }
	.prose :global(table) { width: 100%; border-collapse: collapse; margin: 0.5rem 0; font-size: 0.85rem; }
	.prose :global(th), .prose :global(td) { padding: 0.4rem 0.6rem; border: 1px solid #27272a; text-align: left; }
	.prose :global(th) { background: rgba(39, 39, 42, 0.5); font-weight: 600; }
	.prose :global(input[type="checkbox"]) { margin-right: 0.4rem; accent-color: #a78bfa; }
</style>

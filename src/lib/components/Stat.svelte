<script lang="ts">
	import type { Tone } from '#lib/constants.ts';

	interface Props {
		label: string;
		value: string | number;
		detail?: string;
		href?: string;
		tone?: Tone;
	}

	let { label, value, detail, href, tone = 'neutral' }: Props = $props();

	const colours: Record<Tone, string> = {
		neutral: 'text-fg',
		ok: 'text-ok',
		warn: 'text-warn',
		bad: 'text-bad',
		info: 'text-info'
	};
</script>

{#snippet body()}
	<p class="eyebrow">{label}</p>
	<p class="mt-3 text-4xl font-bold tracking-tight tabular-nums {colours[tone]}">{value}</p>
	{#if detail}
		<p class="mt-2 text-[0.95rem] text-muted">{detail}</p>
	{/if}
{/snippet}

{#if href}
	<a {href} class="tile p-6">
		{@render body()}
	</a>
{:else}
	<div class="tile p-6">
		{@render body()}
	</div>
{/if}

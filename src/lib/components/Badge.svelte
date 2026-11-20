<script lang="ts">
	import type { Option, Tone } from '#lib/constants.ts';

	interface Props {
		/** Pass an option from lib/constants, or a label and tone directly. */
		option?: Option;
		label?: string;
		tone?: Tone;
	}

	let { option, label, tone }: Props = $props();

	const resolvedTone = $derived(tone ?? option?.tone ?? 'neutral');
	const dots: Record<Tone, string> = {
		neutral: 'bg-faint',
		ok: 'bg-ok',
		warn: 'bg-warn',
		bad: 'bg-bad',
		info: 'bg-info'
	};
</script>

<span
	class="inline-flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1 text-[0.82rem] font-semibold whitespace-nowrap"
>
	<span class="size-2 shrink-0 rounded-full {dots[resolvedTone]}" aria-hidden="true"></span>
	{label ?? option?.label ?? ''}
</span>

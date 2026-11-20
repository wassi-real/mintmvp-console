<script lang="ts">
	import { initials } from '#lib/format.ts';

	interface Props {
		name: string;
		src?: string | null;
		size?: number;
	}

	let { name, src = null, size = 36 }: Props = $props();
	let failed = $state(false);
</script>

{#if src && !failed}
	<img
		{src}
		alt=""
		width={size}
		height={size}
		class="shrink-0 rounded-full object-cover"
		style="width: {size}px; height: {size}px"
		onerror={() => (failed = true)}
	/>
{:else}
	<span
		class="inline-flex shrink-0 items-center justify-center rounded-full bg-surface-3 font-bold text-fg select-none"
		style="width: {size}px; height: {size}px; font-size: {Math.max(11, Math.round(size * 0.38))}px"
		aria-hidden="true"
	>
		{initials(name)}
	</span>
{/if}

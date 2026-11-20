<script lang="ts">
	import CircleAlert from '@lucide/svelte/icons/circle-exclamation-point';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import X from '@lucide/svelte/icons/x';
	import { flip } from 'svelte/animate';
	import { fly } from 'svelte/transition';
	import { toasts } from '#lib/toast.svelte.ts';
</script>

<div
	class="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(26rem,calc(100vw-2rem))] flex-col gap-3 sm:right-6 sm:bottom-6"
	role="status"
	aria-live="polite"
>
	{#each toasts.items as toast (toast.id)}
		<div
			class="pointer-events-auto flex items-center gap-3 rounded-block-lg border border-line bg-surface-2 py-3.5 pr-3 pl-4 shadow-(--shadow)"
			in:fly={{ y: 24, duration: 280 }}
			out:fly={{ x: 40, duration: 200 }}
			animate:flip={{ duration: 220 }}
		>
			{#if toast.tone === 'bad'}
				<CircleAlert size={22} class="shrink-0 text-bad" />
			{:else}
				<CircleCheck size={22} class="shrink-0 text-ok" />
			{/if}
			<p class="flex-1 font-medium">{toast.message}</p>
			<button
				type="button"
				class="btn btn-ghost btn-sm btn-icon rounded-full"
				aria-label="Dismiss message"
				onclick={() => toasts.dismiss(toast.id)}
			>
				<X size={18} />
			</button>
		</div>
	{/each}
</div>

<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<main class="flex min-h-dvh flex-col items-center justify-center px-6 py-16 text-center">
	<img
		src="/logo-384.webp"
		alt="MintMVP Console logo"
		width="192"
		height="192"
		class="size-48 animate-pop rounded-[2.75rem] border border-line"
	/>

	<h1 class="mt-12 animate-rise text-5xl sm:text-6xl" style="animation-delay: 80ms">
		MintMVP Console
	</h1>
	<p class="mt-5 animate-rise text-2xl text-muted" style="animation-delay: 140ms">
		Homepage coming soon.
	</p>

	<div
		class="mt-12 flex w-full max-w-md animate-rise flex-col gap-4 sm:flex-row"
		style="animation-delay: 200ms"
	>
		{#if data.signedIn}
			<a href="/dashboard" class="btn btn-primary btn-lg btn-block">
				Open dashboard <ArrowRight size={20} />
			</a>
		{:else}
			<a href="/auth?mode=login" class="btn btn-lg btn-block">Log in</a>
			<a href="/auth?mode=signup" class="btn btn-primary btn-lg btn-block">Sign up</a>
		{/if}
	</div>
</main>

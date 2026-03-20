<script lang="ts">
	import TopNav from '$lib/components/TopNav.svelte';
	import { page } from '$app/stores';
	import { fade } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	let { children } = $props();
</script>

<div class="relative h-screen overflow-hidden bg-background">
	<TopNav />
	<main class="mt-16 flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
		{#key $page.url.pathname}
			<div
				class="flex min-h-0 flex-1 flex-col motion-safe:will-change-opacity"
				in:fade={{ duration: 160, easing: cubicOut }}
				out:fade={{ duration: 80, easing: cubicOut }}
			>
				{@render children()}
			</div>
		{/key}
	</main>
</div>

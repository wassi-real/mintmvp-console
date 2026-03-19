<script lang="ts">
	import TopNav from '$lib/components/TopNav.svelte';

	let { children } = $props();
</script>

<div class="relative h-screen overflow-hidden bg-background">
	<TopNav />
	<main class="mt-16 flex h-[calc(100vh-4rem)] flex-col overflow-hidden">
		{@render children()}
	</main>
</div>

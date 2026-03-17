<script lang="ts">
	import TopNav from '$lib/components/TopNav.svelte';

	let { children } = $props();
</script>

<div class="relative flex min-h-screen flex-col bg-background">
	<TopNav />
	<main class="flex flex-1 flex-col">
		{@render children()}
	</main>
</div>

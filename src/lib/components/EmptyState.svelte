<script lang="ts">
	import { Inbox } from 'lucide-svelte';

	let {
		icon: Icon = Inbox,
		title = 'No data yet',
		description = ''
	}: {
		icon?: any;
		title?: string;
		description?: string;
	} = $props();
</script>

<div class="flex flex-col items-center justify-center py-16 text-center">
	<Icon size={48} class="mb-4 text-muted-foreground" />
	<h3 class="text-xl font-semibold text-foreground">{title}</h3>
	{#if description}
		<p class="mt-1 max-w-sm text-base text-muted-foreground">{description}</p>
	{/if}
</div>

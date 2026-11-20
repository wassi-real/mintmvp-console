<script lang="ts">
	import './layout.css';
	import Toaster from '#lib/components/Toaster.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<title>MintMVP Console</title>
	<meta
		name="description"
		content="MintMVP Console: one workspace for projects, tasks, delivery and operations."
	/>
</svelte:head>

{@render children()}
<Toaster />

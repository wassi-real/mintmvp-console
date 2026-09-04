<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<!--
	Shared shell for the milestone area. The project layout already owns the page padding and
	the scroll pane, so this only caps the reading width — it must not introduce padding or a
	scroll container of its own, otherwise the sticky page headers lose their full-bleed gutters.
-->
<div class="mx-auto w-full max-w-[1600px]">
	{@render children()}
</div>

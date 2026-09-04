<script lang="ts">
	import { LayoutGrid, Rows3 } from 'lucide-svelte';
	import type { ViewMode } from '$lib/view-mode';

	let { mode, onChange }: { mode: ViewMode; onChange: (next: ViewMode) => void } = $props();
</script>

<div
	class="relative flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-card p-1"
	role="group"
	aria-label="Change layout"
>
	<!-- Sliding highlight: transform-only so it stays on the compositor -->
	<span
		aria-hidden="true"
		class="pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-md bg-secondary transition-transform duration-200 ease-out motion-reduce:transition-none"
		style:transform={mode === 'list' ? 'translateX(100%)' : 'translateX(0)'}
	></span>

	<button
		type="button"
		onclick={() => onChange('grid')}
		aria-pressed={mode === 'grid'}
		title="Grid view"
		class="relative z-10 flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors {mode ===
		'grid'
			? 'text-foreground'
			: 'text-muted-foreground hover:text-foreground'}"
	>
		<LayoutGrid size={16} />
		<span class="ml-1.5 hidden sm:inline">Grid</span>
	</button>
	<button
		type="button"
		onclick={() => onChange('list')}
		aria-pressed={mode === 'list'}
		title="List view"
		class="relative z-10 flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors {mode ===
		'list'
			? 'text-foreground'
			: 'text-muted-foreground hover:text-foreground'}"
	>
		<Rows3 size={16} />
		<span class="ml-1.5 hidden sm:inline">List</span>
	</button>
</div>

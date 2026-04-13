<script lang="ts">
	let {
		label,
		value,
		icon: Icon,
		variant = 'default'
	}: {
		label: string;
		value: string | number;
		icon?: any;
		variant?: 'default' | 'success' | 'warning' | 'destructive';
	} = $props();

	const variantColors = {
		default: 'text-foreground',
		success: 'text-success',
		warning: 'text-warning',
		destructive: 'text-destructive'
	};
</script>

<div class="rounded-xl border border-border bg-card p-4 sm:p-6">
	<div class="flex items-center justify-between">
		<p class="text-xs font-medium text-muted-foreground sm:text-sm">{label}</p>
		{#if Icon}
			<Icon size={20} class="hidden text-muted-foreground sm:block" />
		{/if}
	</div>
	<p class="mt-1.5 text-2xl font-bold sm:mt-2 sm:text-4xl {variantColors[variant]}">{value}</p>
</div>

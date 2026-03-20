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

<div class="rounded-xl border border-border bg-card p-6">
	<div class="flex items-center justify-between">
		<p class="text-base font-medium text-muted-foreground">{label}</p>
		{#if Icon}
			<Icon size={24} class="text-muted-foreground" />
		{/if}
	</div>
	<p class="mt-2 text-4xl font-bold {variantColors[variant]}">{value}</p>
</div>

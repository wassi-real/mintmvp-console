<script lang="ts">
	import PageHeader from '$lib/components/PageHeader.svelte';
	import { FileText, ListTodo, FlaskConical, Server, Rocket, HeartPulse } from 'lucide-svelte';

	let { data } = $props();

	const stageIcons = [FileText, ListTodo, FlaskConical, Server, Rocket, HeartPulse];

	const statusColors: Record<string, string> = {
		passed: 'border-green-500 bg-green-950/30 text-green-400',
		in_progress: 'border-amber-500 bg-amber-950/30 text-amber-400',
		failed: 'border-red-500 bg-red-950/30 text-red-400',
		empty: 'border-border bg-card text-muted-foreground',
		pending: 'border-border bg-card text-muted-foreground'
	};

	const statusLabels: Record<string, string> = {
		passed: 'Passed',
		in_progress: 'In Progress',
		failed: 'Failed',
		empty: 'No Data',
		pending: 'Pending'
	};

	const dotColors: Record<string, string> = {
		passed: 'bg-green-500',
		in_progress: 'bg-amber-500',
		failed: 'bg-red-500',
		empty: 'bg-muted-foreground/30',
		pending: 'bg-muted-foreground/30'
	};
</script>

<div>
	<PageHeader title="Pipeline" description="Spec to Production at a glance" />

	<!-- Pipeline stepper — stacks vertically on small, 2-col on medium, horizontal on large -->
	<div class="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
		{#each data.stages as stage, i}
			{@const Icon = stageIcons[i]}
			<div class="flex flex-col items-center rounded-xl border-2 p-5 transition-colors {statusColors[stage.status]}">
				<Icon size={24} class="mb-2 shrink-0" />
				<h3 class="text-base font-bold">{stage.name}</h3>
				<div class="mt-1.5 flex items-center gap-2">
					<span class="h-2 w-2 rounded-full {dotColors[stage.status]}"></span>
					<span class="text-xs font-medium">{statusLabels[stage.status]}</span>
				</div>
				<p class="mt-1.5 text-center text-xs opacity-80">{stage.detail}</p>
				<p class="mt-0.5 text-[11px] opacity-60">{stage.count} items</p>
			</div>
		{/each}
	</div>

	<!-- Summary table -->
	<div class="mt-8 overflow-x-auto rounded-xl border border-border">
		<table class="w-full text-left">
			<thead class="border-b border-border bg-secondary/50">
				<tr>
					<th class="px-5 py-3 text-sm font-semibold text-foreground">Stage</th>
					<th class="px-5 py-3 text-sm font-semibold text-foreground">Status</th>
					<th class="hidden px-5 py-3 text-sm font-semibold text-foreground sm:table-cell">Items</th>
					<th class="px-5 py-3 text-sm font-semibold text-foreground">Detail</th>
				</tr>
			</thead>
			<tbody>
				{#each data.stages as stage}
					<tr class="border-b border-border transition-colors hover:bg-secondary/30">
						<td class="px-5 py-3 text-base font-semibold text-foreground">{stage.name}</td>
						<td class="px-5 py-3">
							<span class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium {statusColors[stage.status]}">
								<span class="h-1.5 w-1.5 rounded-full {dotColors[stage.status]}"></span>
								{statusLabels[stage.status]}
							</span>
						</td>
						<td class="hidden px-5 py-3 text-sm text-muted-foreground sm:table-cell">{stage.count}</td>
						<td class="px-5 py-3 text-sm text-muted-foreground">{stage.detail}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

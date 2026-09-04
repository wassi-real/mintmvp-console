<script lang="ts">
	import PageTitleBar from '$lib/components/PageTitleBar.svelte';
	import { FileText, ListTodo, FlaskConical, Server, Rocket, HeartPulse, GitBranch, ChevronRight, Info } from 'lucide-svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let { data } = $props();

	function onBranchChange(name: string) {
		const u = new URL($page.url);
		u.searchParams.set('branch', name);
		goto(`${u.pathname}?${u.searchParams.toString()}`, { replaceState: true, noScroll: true });
	}

	const stageIcons = [FileText, ListTodo, FlaskConical, Server, Rocket, HeartPulse];

	const statusSurface: Record<string, string> = {
		passed: 'border-success/40 bg-success/5',
		in_progress: 'border-warning/40 bg-warning/5',
		failed: 'border-destructive/40 bg-destructive/5',
		empty: 'border-border bg-card',
		pending: 'border-border bg-card'
	};

	const statusText: Record<string, string> = {
		passed: 'text-success',
		in_progress: 'text-warning',
		failed: 'text-destructive',
		empty: 'text-muted-foreground',
		pending: 'text-muted-foreground'
	};

	const statusPill: Record<string, string> = {
		passed: 'border-success/30 bg-success/10 text-success',
		in_progress: 'border-warning/30 bg-warning/10 text-warning',
		failed: 'border-destructive/30 bg-destructive/10 text-destructive',
		empty: 'border-border bg-secondary/50 text-muted-foreground',
		pending: 'border-border bg-secondary/50 text-muted-foreground'
	};

	const statusLabels: Record<string, string> = {
		passed: 'Passed',
		in_progress: 'In Progress',
		failed: 'Failed',
		empty: 'No Data',
		pending: 'Pending'
	};

	const dotColors: Record<string, string> = {
		passed: 'bg-success',
		in_progress: 'bg-warning',
		failed: 'bg-destructive',
		empty: 'bg-muted-foreground/40',
		pending: 'bg-muted-foreground/40'
	};

	const summary = $derived.by(() => {
		const count = (...statuses: string[]) =>
			data.stages.filter((s: any) => statuses.includes(s.status)).length;
		const failed = count('failed');
		const active = count('in_progress');
		const passed = count('passed');
		return [
			{ label: 'Passed', value: passed, tone: passed > 0 ? 'text-success' : 'text-foreground' },
			{ label: 'In progress', value: active, tone: active > 0 ? 'text-warning' : 'text-foreground' },
			{ label: 'Failed', value: failed, tone: failed > 0 ? 'text-destructive' : 'text-foreground' },
			{ label: 'No data', value: count('empty', 'pending'), tone: 'text-foreground' }
		];
	});

	function delay(i: number) {
		return `${Math.min(i, 8) * 40}ms`;
	}
</script>

<PageTitleBar title="Pipeline" description="Spec to production at a glance">
	{#snippet meta()}
		<span class="tabular-nums">{summary[0].value}/{data.stages.length} stages passed</span>
		{#if data.selectedBranch}
			<span class="text-muted-foreground/40">·</span>
			<span class="inline-flex items-center gap-1.5 rounded-md bg-secondary/60 px-2 py-0.5 font-mono text-xs text-foreground">
				<GitBranch size={12} class="text-muted-foreground" />
				{data.selectedBranch}
			</span>
		{/if}
	{/snippet}
	{#snippet actions()}
		{#if data.branches?.length}
			<label
				for="pipe-branch"
				class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
			>
				<GitBranch size={14} />
				<span class="hidden sm:inline">Branch</span>
			</label>
			<select
				id="pipe-branch"
				class="max-w-[13rem] rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
				value={data.selectedBranch}
				onchange={(e) => onBranchChange((e.currentTarget as HTMLSelectElement).value)}
			>
				{#each data.branches as b (b)}
					<option value={b}>{b}</option>
				{/each}
			</select>
		{/if}
	{/snippet}
</PageTitleBar>

<!-- Stage health, grouped into a single quiet card -->
<div
	class="rise grid grid-cols-2 gap-y-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-4 sm:gap-y-0 sm:divide-x sm:divide-border/60 sm:p-5"
>
	{#each summary as stat (stat.label)}
		<div class="sm:px-5 sm:first:pl-0 sm:last:pr-0">
			<p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{stat.label}</p>
			<p class="mt-1 text-2xl font-bold tabular-nums leading-none {stat.tone}">{stat.value}</p>
		</div>
	{/each}
</div>

<p class="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
	<Info size={14} class="mt-0.5 shrink-0" />
	{#if data.branches?.length}
		<span>
			Testing uses GitHub Actions runs for the selected branch. Staging and Production use GitHub
			deployments whose ref matches it, falling back to manual deploy rows when there are none.
		</span>
	{:else}
		<span>
			No Git branches synced yet. Connect GitHub under Settings to populate branches and
			branch-scoped CI.
		</span>
	{/if}
</p>

<!-- Pipeline stepper — stacks on small screens, one connected row on xl -->
<div class="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
	{#each data.stages as stage, i (stage.name)}
		{@const Icon = stageIcons[i]}
		<div
			class="rise card-hover relative flex flex-col rounded-xl border p-4 {statusSurface[stage.status] ??
				'border-border bg-card'}"
			style:--delay={delay(i)}
		>
			<div class="flex items-start gap-2.5">
				<span class="shrink-0 rounded-lg bg-secondary/60 p-2 {statusText[stage.status] ?? 'text-muted-foreground'}">
					<Icon size={16} />
				</span>
				<div class="min-w-0">
					<p class="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
						Step {i + 1}
					</p>
					<h3 class="truncate text-sm font-bold text-foreground">{stage.name}</h3>
				</div>
				<span class="ml-auto shrink-0 text-sm font-bold tabular-nums text-muted-foreground">
					{stage.count}
				</span>
			</div>

			<div class="mt-3 flex items-center gap-1.5">
				<span class="h-1.5 w-1.5 shrink-0 rounded-full {dotColors[stage.status] ?? 'bg-muted-foreground/40'}"></span>
				<span class="text-xs font-semibold {statusText[stage.status] ?? 'text-muted-foreground'}">
					{statusLabels[stage.status] ?? stage.status}
				</span>
			</div>

			<p class="mt-1 text-xs leading-relaxed text-muted-foreground">{stage.detail}</p>

			{#if i < data.stages.length - 1}
				<ChevronRight
					size={14}
					aria-hidden="true"
					class="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-muted-foreground/40 xl:block"
				/>
			{/if}
		</div>
	{/each}
</div>

<!-- Summary table -->
<div class="mt-5 overflow-hidden rounded-xl border border-border bg-card">
	<div class="overflow-x-auto">
		<table class="w-full min-w-[36rem] text-left">
			<thead class="border-b border-border bg-secondary/40">
				<tr>
					<th class="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stage</th>
					<th class="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
					<th class="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:table-cell">Items</th>
					<th class="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detail</th>
				</tr>
			</thead>
			<tbody>
				{#each data.stages as stage, i (stage.name)}
					<tr class="rise row-hover border-b border-border/60 last:border-b-0" style:--delay={delay(i)}>
						<td class="px-4 py-2.5 text-sm font-semibold text-foreground">{stage.name}</td>
						<td class="px-4 py-2.5">
							<span
								class="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium {statusPill[
									stage.status
								] ?? 'border-border bg-secondary/50 text-muted-foreground'}"
							>
								<span class="h-1.5 w-1.5 rounded-full {dotColors[stage.status] ?? 'bg-muted-foreground/40'}"></span>
								{statusLabels[stage.status] ?? stage.status}
							</span>
						</td>
						<td class="hidden px-4 py-2.5 text-sm tabular-nums text-muted-foreground sm:table-cell">
							{stage.count}
						</td>
						<td class="px-4 py-2.5 text-sm text-muted-foreground">{stage.detail}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

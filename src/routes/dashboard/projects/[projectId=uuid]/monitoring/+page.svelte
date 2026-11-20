<script lang="ts">
	import Play from '@lucide/svelte/icons/play';
	import Badge from '#lib/components/Badge.svelte';
	import DataSection from '#lib/components/DataSection.svelte';
	import Form from '#lib/components/Form.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Stat from '#lib/components/Stat.svelte';
	import Time from '#lib/components/Time.svelte';
	import { uptimeStatus } from '#lib/constants.ts';
	import { formatNumber } from '#lib/format.ts';
	import { monitoringTargetFields } from '#lib/sections.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const status = $derived(uptimeStatus(data.health?.uptime_status ?? 'unknown'));
	const failing = $derived(data.targets.filter((target) => target.latest && !target.latest.ok));

	const rows = $derived(
		data.targets.map((target) => ({
			...target,
			state: !target.enabled ? 'Paused' : !target.latest ? 'Not checked' : target.latest.ok ? 'Up' : 'Down',
			response: target.latest ? `${formatNumber(target.latest.duration_ms)} ms` : '',
			detail: target.latest?.error_message ?? ''
		}))
	);
</script>

<svelte:head>
	<title>Monitoring · {data.project.name}</title>
</svelte:head>

<PageHeader
	title="Monitoring"
	description="Checks whether your sites answer. Press “Check now” to probe every enabled address."
>
	{#if data.canEdit && data.targets.some((target) => target.enabled)}
		<Form action="?/check">
			{#snippet children({ pending })}
				<button type="submit" class="btn btn-primary" disabled={pending}>
					<Play size={18} /> {pending ? 'Checking…' : 'Check now'}
				</button>
			{/snippet}
		</Form>
	{/if}
</PageHeader>

<div class="stagger mb-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
	<Stat label="Overall" value={status.label} tone={status.tone} />
	<Stat label="Addresses watched" value={data.targets.filter((target) => target.enabled).length} detail="{data.targets.length} in total" />
	<Stat label="Failing" value={failing.length} tone={failing.length ? 'bad' : 'neutral'} />
	<Stat
		label="Last check"
		value={data.health?.last_check_at ? 'Done' : 'Never'}
		detail={data.health?.last_check_at ? undefined : 'No checks have been run'}
	/>
</div>

{#if data.health?.last_check_at}
	<p class="-mt-4 mb-8 text-muted">Last check <Time value={data.health.last_check_at} relative />.</p>
{/if}

<div class="grid gap-8">
	<DataSection
		title="Addresses"
		noun="address"
		rows={rows}
		fields={monitoringTargetFields}
		canEdit={data.canEdit}
		titleKey="name"
		columns={[
			{ key: 'name', label: 'Address', primary: true, sub: (row) => String(row.url ?? '') },
			{
				key: 'state',
				label: 'Status',
				kind: 'badge',
				option: (value) =>
					value === 'Up'
						? { value: 'up', label: 'Up', tone: 'ok' }
						: value === 'Down'
							? { value: 'down', label: 'Down', tone: 'bad' }
							: value === 'Paused'
								? { value: 'paused', label: 'Paused', tone: 'neutral' }
								: { value: 'unknown', label: 'Not checked', tone: 'neutral' }
			},
			{ key: 'response', label: 'Response' },
			{ key: 'detail', label: 'Last problem' }
		]}
		emptyTitle="Nothing is being watched"
		emptyMessage="Add the web addresses you want to keep an eye on, then run a check."
	>
		{#snippet rowActions(row)}
			{#if data.canEdit && row.enabled}
				<Form action="?/check" toast={false}>
					{#snippet children({ pending })}
						<input type="hidden" name="id" value={row.id} />
						<button type="submit" class="btn btn-ghost btn-sm btn-icon" aria-label="Check {row.name} now" title="Check now" disabled={pending}>
							<Play size={16} />
						</button>
					{/snippet}
				</Form>
			{/if}
		{/snippet}
	</DataSection>

	<DataSection
		title="Recent checks"
		noun="check"
		rows={data.runs.map((run) => ({
			...run,
			address: data.targets.find((target) => target.id === run.target_id)?.name ?? 'Removed address',
			result: run.ok ? 'Responded' : 'Problem'
		}))}
		searchFrom={12}
		columns={[
			{ key: 'address', label: 'Address', primary: true, sub: (row) => String(row.error_message ?? '') },
			{
				key: 'result',
				label: 'Result',
				kind: 'badge',
				option: (value) =>
					value === 'Responded'
						? { value: 'ok', label: 'Responded', tone: 'ok' }
						: { value: 'bad', label: 'Problem', tone: 'bad' }
			},
			{ key: 'http_status', label: 'HTTP', kind: 'number' },
			{ key: 'duration_ms', label: 'Time', value: (row) => `${formatNumber(Number(row.duration_ms ?? 0))} ms` },
			{ key: 'checked_at', label: 'When', kind: 'time' }
		]}
		emptyTitle="No checks yet"
		emptyMessage="Results appear here after the first check."
	/>
</div>

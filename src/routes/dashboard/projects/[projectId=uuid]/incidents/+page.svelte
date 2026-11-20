<script lang="ts">
	import DataSection from '#lib/components/DataSection.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Stat from '#lib/components/Stat.svelte';
	import { incidentSeverity, incidentStatus } from '#lib/constants.ts';
	import { incidentFields } from '#lib/sections.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const open = $derived(data.incidents.filter((incident) => incident.status !== 'resolved'));
	const serious = $derived(
		open.filter((incident) => incident.severity === 'critical' || incident.severity === 'high')
	);
</script>

<svelte:head>
	<title>Incidents · {data.project.name}</title>
</svelte:head>

<PageHeader
	title="Incidents"
	description="Problems that affect people using the product, and what is being done about them."
/>

<div class="stagger mb-8 grid gap-5 sm:grid-cols-3">
	<Stat label="Open" value={open.length} tone={open.length ? 'warn' : 'neutral'} />
	<Stat label="Critical or high" value={serious.length} tone={serious.length ? 'bad' : 'neutral'} />
	<Stat label="Resolved" value={data.incidents.length - open.length} />
</div>

<DataSection
	title="Incidents"
	noun="incident"
	rows={data.incidents}
	fields={incidentFields}
	canEdit={data.canEdit}
	columns={[
		{ key: 'title', label: 'Incident', primary: true, sub: (row) => String(row.description ?? '') },
		{ key: 'severity', label: 'Severity', kind: 'badge', option: incidentSeverity },
		{ key: 'status', label: 'Status', kind: 'badge', option: incidentStatus },
		{ key: 'created_at', label: 'Reported', kind: 'time' },
		{ key: 'resolved_at', label: 'Resolved', kind: 'time' }
	]}
	emptyTitle="No incidents"
	emptyMessage="Good news. When something goes wrong, record it here so everyone knows."
/>
<script lang="ts">
	import DataSection from '#lib/components/DataSection.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Stat from '#lib/components/Stat.svelte';
	import { deploymentStatus, ghDeploymentStatus, logSeverity } from '#lib/constants.ts';
	import { shortSha } from '#lib/format.ts';
	import { deploymentFields } from '#lib/sections.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const latest = $derived(data.deployments[0] ?? null);
</script>

<svelte:head>
	<title>Deployments · {data.project.name}</title>
</svelte:head>

<PageHeader
	title="Deployments"
	description="Releases you record yourself, deployments reported by GitHub, and events from your hosting logs."
/>

<div class="stagger mb-8 grid gap-5 sm:grid-cols-3">
	<Stat
		label="Latest recorded release"
		value={latest?.version ?? 'None'}
		detail={latest ? deploymentStatus(latest.status).label : 'Record one below'}
		tone={latest ? (deploymentStatus(latest.status).tone ?? 'neutral') : 'neutral'}
	/>
	<Stat label="GitHub deployments" value={data.github.length} />
	<Stat label="Log problems" value={data.problems} tone={data.problems ? 'bad' : 'neutral'} detail="Errors found in hosting logs" />
</div>

<div class="grid gap-8">
	<DataSection
		title="Recorded releases"
		noun="deployment"
		rows={data.deployments}
		fields={deploymentFields}
		canEdit={data.canEdit}
		titleKey="version"
		columns={[
			{ key: 'version', label: 'Version', primary: true, sub: (row) => String(row.notes ?? '') },
			{ key: 'environment', label: 'Where', kind: 'badge', option: (value) => ({ value: value ?? '', label: value === 'production' ? 'Production' : 'Staging' }) },
			{ key: 'status', label: 'Result', kind: 'badge', option: deploymentStatus },
			{ key: 'created_at', label: 'When', kind: 'time' }
		]}
		emptyTitle="No releases recorded"
		emptyMessage="Record each release so there is a history of what went out and when."
	/>

	<DataSection
		title="Deployments from GitHub"
		noun="deployment"
		rows={data.github}
		searchFrom={12}
		columns={[
			{ key: 'environment', label: 'Environment', primary: true, sub: (row) => String(row.ref ?? '') },
			{ key: 'status', label: 'Result', kind: 'badge', option: ghDeploymentStatus },
			{ key: 'commit_sha', label: 'Commit', kind: 'mono', value: (row) => shortSha(String(row.commit_sha ?? '')) },
			{ key: 'created_at', label: 'When', kind: 'time' }
		]}
		emptyTitle="No GitHub deployments"
		emptyMessage="These appear after a sync from the Code page."
	/>

	<DataSection
		title="Events from hosting logs"
		noun="event"
		rows={data.events}
		searchFrom={12}
		columns={[
			{ key: 'title', label: 'Event', primary: true, sub: (row) => String(row.detail ?? '') },
			{ key: 'severity', label: 'Level', kind: 'badge', option: logSeverity },
			{ key: 'kind', label: 'Kind' },
			{ key: 'occurred_at', label: 'When', kind: 'time' }
		]}
		emptyTitle="No log events"
		emptyMessage="Connect Railway on the Integrations page and its important log lines show up here."
	/>
</div>

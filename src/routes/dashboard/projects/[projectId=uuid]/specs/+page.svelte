<script lang="ts">
	import DataSection from '#lib/components/DataSection.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { specStatus } from '#lib/constants.ts';
	import { specFields } from '#lib/sections.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Specs · {data.project.name}</title>
</svelte:head>

<PageHeader
	title="Specs"
	description="A spec describes what should be built and how you will know it is done."
/>

<DataSection
	title="Specs"
	noun="spec"
	rows={data.specs}
	fields={specFields}
	canEdit={data.canEdit}
	dialogSize="lg"
	columns={[
		{ key: 'title', label: 'Spec', primary: true, sub: (row) => String(row.summary ?? row.goal ?? '') },
		{ key: 'status', label: 'Status', kind: 'badge', option: specStatus },
		{ key: 'created_at', label: 'Added', kind: 'time' }
	]}
	emptyMessage="Write down what you want built before the work starts."
/>
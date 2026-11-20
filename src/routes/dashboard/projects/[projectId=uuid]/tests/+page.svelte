<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import DataSection from '#lib/components/DataSection.svelte';
	import Form from '#lib/components/Form.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import Stat from '#lib/components/Stat.svelte';
	import { testStatus, testType } from '#lib/constants.ts';
	import { percent } from '#lib/format.ts';
	import { testFields } from '#lib/sections.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const fields = $derived(testFields({ specs: data.specs, tasks: data.tasks }));
	const passing = $derived(data.tests.filter((test) => test.status === 'pass').length);
	const failing = $derived(data.tests.filter((test) => test.status === 'fail').length);
</script>

<svelte:head>
	<title>Tests · {data.project.name}</title>
</svelte:head>

<PageHeader title="Tests" description="Checks that prove the product works. Record each result here." />

<div class="stagger mb-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
	<Stat label="Pass rate" value="{percent(passing, data.tests.length)}%" detail="{passing} of {data.tests.length}" />
	<Stat label="Passing" value={passing} tone={passing ? 'ok' : 'neutral'} />
	<Stat label="Failing" value={failing} tone={failing ? 'bad' : 'neutral'} />
	<Stat label="Not run" value={data.tests.length - passing - failing} />
</div>

<DataSection
	title="Tests"
	noun="test"
	rows={data.tests}
	{fields}
	canEdit={data.canEdit}
	titleKey="name"
	columns={[
		{ key: 'name', label: 'Test', primary: true, sub: (row) => String(row.notes ?? '') },
		{ key: 'type', label: 'Type', kind: 'badge', option: testType },
		{ key: 'status', label: 'Result', kind: 'badge', option: testStatus },
		{ key: 'last_run', label: 'Last run', kind: 'time' }
	]}
	emptyMessage="List the checks you run before each release."
>
	{#snippet rowActions(row)}
		{#if data.canEdit}
			<Form action="?/result" class="flex gap-1.5">
				{#snippet children({ pending })}
					<input type="hidden" name="id" value={row.id} />
					<button
						type="submit"
						name="status"
						value="pass"
						class="btn btn-ghost btn-sm btn-icon hover:text-ok"
						title="Mark as passing"
						aria-label="Mark {row.name} as passing"
						disabled={pending}
					>
						<Check size={18} />
					</button>
					<button
						type="submit"
						name="status"
						value="fail"
						class="btn btn-ghost btn-sm btn-icon hover:text-bad"
						title="Mark as failing"
						aria-label="Mark {row.name} as failing"
						disabled={pending}
					>
						<X size={18} />
					</button>
				{/snippet}
			</Form>
		{/if}
	{/snippet}
</DataSection>
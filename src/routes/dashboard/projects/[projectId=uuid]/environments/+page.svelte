<script lang="ts">
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Trash from '@lucide/svelte/icons/trash';
	import Badge from '#lib/components/Badge.svelte';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import RecordDialog from '#lib/components/RecordDialog.svelte';
	import Time from '#lib/components/Time.svelte';
	import { ENVIRONMENT_KINDS, environmentKind, environmentStatus } from '#lib/constants.ts';
	import { environmentFields } from '#lib/sections.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	type Environment = (typeof data.environments)[number];
	let editing = $state<Environment | null>(null);
	let editOpen = $state(false);
	let deleting = $state<Environment | null>(null);
	let deleteOpen = $state(false);

	const missing = $derived(
		ENVIRONMENT_KINDS.filter((kind) => !data.environments.some((e) => e.kind === kind.value))
	);
	const hints: Record<string, string> = {
		production: 'The live product your customers use.',
		staging: 'A private copy for checking changes before they go live.',
		development: 'Where new work is built and tried out.'
	};
</script>

<svelte:head>
	<title>Environments · {data.project.name}</title>
</svelte:head>

<PageHeader title="Environments" description="The places where this product runs, and what is running there.">
	{#if data.canEdit && missing.length > 0}
		<button
			type="button"
			class="btn btn-primary"
			onclick={() => {
				editing = null;
				editOpen = true;
			}}
		>
			<Plus size={20} /> Add environment
		</button>
	{/if}
</PageHeader>

{#if data.environments.length === 0}
	<EmptyState title="No environments yet" message="Add production, staging or development to keep track of what runs where." />
{:else}
	<div class="stagger grid gap-5 lg:grid-cols-3">
		{#each data.environments as environment (environment.id)}
			<article class="tile flex flex-col p-6">
				<div class="flex items-start justify-between gap-3">
					<h2 class="text-2xl">{environmentKind(environment.kind).label}</h2>
					<Badge option={environmentStatus(environment.status)} />
				</div>
				<p class="mt-1.5 text-[0.93rem] text-muted">{hints[environment.kind] ?? ''}</p>

				<dl class="mt-6 grid flex-1 gap-4">
					<div>
						<dt class="eyebrow">Web address</dt>
						<dd class="mt-1">
							{#if environment.url}
								<a href={environment.url} target="_blank" rel="noreferrer" class="link inline-flex items-center gap-1.5 break-all">
									{environment.url.replace(/^https?:\/\//, '')} <ExternalLink size={14} class="shrink-0" />
								</a>
							{:else}
								<span class="text-faint">Not set</span>
							{/if}
						</dd>
					</div>
					<div>
						<dt class="eyebrow">Version running now</dt>
						<dd class="mono mt-1">{environment.current_version || '—'}</dd>
					</div>
					<div>
						<dt class="eyebrow">Last updated</dt>
						<dd class="mt-1"><Time value={environment.last_deploy_at} relative fallback="Not recorded" /></dd>
					</div>
				</dl>

				{#if data.canEdit}
					<div class="mt-6 flex gap-2">
						<button
							type="button"
							class="btn btn-sm flex-1"
							onclick={() => {
								editing = environment;
								editOpen = true;
							}}
						>
							<Pencil size={16} /> Edit
						</button>
						<button
							type="button"
							class="btn btn-ghost btn-sm btn-icon hover:text-bad"
							aria-label="Delete {environmentKind(environment.kind).label} environment"
							title="Delete"
							onclick={() => {
								deleting = environment;
								deleteOpen = true;
							}}
						>
							<Trash size={16} />
						</button>
					</div>
				{/if}
			</article>
		{/each}
	</div>
{/if}

{#if data.canEdit}
	{#key editing?.id ?? 'new'}
		<RecordDialog
			bind:open={editOpen}
			noun="environment"
			fields={editing
				? environmentFields.filter((field) => field.name !== 'kind')
				: environmentFields.map((field) =>
						field.name === 'kind' ? { ...field, options: missing, initial: missing[0]?.value } : field
					)}
			record={editing}
		>
			{#snippet extra()}
				{#if editing}<input type="hidden" name="kind" value={editing.kind} />{/if}
			{/snippet}
		</RecordDialog>
	{/key}
	<ConfirmDialog
		bind:open={deleteOpen}
		title="Delete this environment?"
		message={`The ${environmentKind(deleting?.kind).label} environment record will be deleted. The real site is not affected.`}
		values={{ id: deleting?.id ?? '' }}
	/>
{/if}
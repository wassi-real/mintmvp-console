<script lang="ts">
	import FieldInput from '#lib/components/FieldInput.svelte';
	import Form from '#lib/components/Form.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { formatDate } from '#lib/format.ts';
	import { projectFields } from '#lib/sections.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let confirmation = $state('');
</script>

<svelte:head>
	<title>Project settings · {data.project.name}</title>
</svelte:head>

<PageHeader title="Project settings" description="The basics for {data.project.name}." />

<div class="grid max-w-3xl gap-8">
	<section class="panel">
		<header class="panel-header"><h2 class="panel-title">Details</h2></header>
		<div class="panel-body">
			<Form action="?/save" reset={false}>
				{#snippet children({ pending, errors })}
					<div class="grid gap-5 sm:grid-cols-2">
						{#each projectFields as field (field.name)}
							<FieldInput {field} value={data.project[field.name as keyof typeof data.project] as never} error={errors[field.name]} />
						{/each}
					</div>
					{#if data.canEdit}
						<div class="mt-8 flex justify-end">
							<button type="submit" class="btn btn-primary" disabled={pending}>
								{pending ? 'Saving…' : 'Save changes'}
							</button>
						</div>
					{:else}
						<p class="notice mt-6">You have view-only access, so these details cannot be changed.</p>
					{/if}
				{/snippet}
			</Form>
			<p class="mt-4 text-[0.9rem] text-muted">Created {formatDate(data.project.created_at)}.</p>
		</div>
	</section>

	{#if data.isOwner}
		<section class="panel border-bad/40!">
			<header class="panel-header"><h2 class="panel-title text-bad">Delete this project</h2></header>
			<div class="panel-body">
				<p class="text-muted">
					This permanently deletes the project and everything inside it: tasks, milestones, reports,
					tests, logs and finance records. There is no way back.
				</p>
				<Form action="?/delete" class="mt-5">
					{#snippet children({ pending, errors })}
						<label class="label" for="confirmation">
							Type <strong>{data.project.name}</strong> to confirm
						</label>
						<input
							id="confirmation"
							name="confirmation"
							class="input"
							autocomplete="off"
							bind:value={confirmation}
							aria-invalid={errors.confirmation ? 'true' : undefined}
						/>
						{#if errors.confirmation}<p class="field-error">{errors.confirmation}</p>{/if}
						<div class="mt-5">
							<button type="submit" class="btn btn-danger" disabled={pending || confirmation !== data.project.name}>
								{pending ? 'Deleting…' : 'Delete project forever'}
							</button>
						</div>
					{/snippet}
				</Form>
			</div>
		</section>
	{/if}
</div>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fieldDefaults, type Field, type FieldValues } from '#lib/fields.ts';
	import Dialog from './Dialog.svelte';
	import FieldInput from './FieldInput.svelte';
	import Form from './Form.svelte';

	interface Props {
		open: boolean;
		/** Singular name, for example "incident". */
		noun: string;
		fields: readonly Field[];
		/** The record being edited. Leave empty to create a new one. */
		record?: (FieldValues & { id?: string }) | Record<string, unknown> | null;
		createAction?: string;
		updateAction?: string;
		/** Extra hidden inputs or notes rendered above the buttons. */
		extra?: Snippet;
		size?: 'md' | 'lg';
	}

	let {
		open = $bindable(false),
		noun,
		fields,
		record = null,
		createAction = '?/create',
		updateAction = '?/update',
		extra,
		size = 'md'
	}: Props = $props();

	const editing = $derived(Boolean(record && record.id));
	const values = $derived({ ...fieldDefaults(fields), ...(record ?? {}) } as FieldValues);
</script>

<Dialog bind:open title={editing ? `Edit ${noun}` : `New ${noun}`} {size}>
	<Form action={editing ? updateAction : createAction} onsuccess={() => (open = false)}>
		{#snippet children({ pending, errors })}
			{#if editing}
				<input type="hidden" name="id" value={String(record?.id)} />
			{/if}
			<div class="grid gap-5 sm:grid-cols-2">
				{#each fields as field (field.name)}
					<FieldInput {field} value={values[field.name]} error={errors[field.name]} />
				{/each}
			</div>
			{@render extra?.()}
			<div class="mt-8 flex flex-wrap justify-end gap-3">
				<button type="button" class="btn" onclick={() => (open = false)}>Cancel</button>
				<button type="submit" class="btn btn-primary" disabled={pending}>
					{pending ? 'Saving…' : editing ? 'Save changes' : `Create ${noun}`}
				</button>
			</div>
		{/snippet}
	</Form>
</Dialog>

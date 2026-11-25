<script lang="ts">
	import { fieldDefaults, type Field } from '#lib/fields.ts';
	import Dialog from './Dialog.svelte';
	import FieldInput from './FieldInput.svelte';
	import Form from './Form.svelte';

	interface Props {
		open: boolean;
		title: string;
		/** Form action, for example "?/check". */
		action: string;
		fields: readonly Field[];
		/** Hidden values sent with the form, for example { id }. */
		values?: Record<string, string>;
		intro?: string;
		submitLabel: string;
		danger?: boolean;
	}

	let {
		open = $bindable(false),
		title,
		action,
		fields,
		values = {},
		intro,
		submitLabel,
		danger = false
	}: Props = $props();

	const defaults = $derived(fieldDefaults(fields));
</script>

<Dialog bind:open {title}>
	<Form {action} onsuccess={() => (open = false)}>
		{#snippet children({ pending, errors })}
			{#each Object.entries(values) as [name, value] (name)}
				<input type="hidden" {name} {value} />
			{/each}
			{#if intro}
				<p class="mb-5 text-muted">{intro}</p>
			{/if}
			<div class="grid gap-5 sm:grid-cols-2">
				{#each fields as field (field.name)}
					<FieldInput {field} value={defaults[field.name]} error={errors[field.name]} />
				{/each}
			</div>
			<div class="mt-8 flex flex-wrap justify-end gap-3">
				<button type="button" class="btn" onclick={() => (open = false)}>Cancel</button>
				<button type="submit" class="btn {danger ? 'btn-danger' : 'btn-primary'}" disabled={pending}>
					{pending ? 'Saving…' : submitLabel}
				</button>
			</div>
		{/snippet}
	</Form>
</Dialog>

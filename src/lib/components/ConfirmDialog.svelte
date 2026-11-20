<script lang="ts">
	import Dialog from './Dialog.svelte';
	import Form from './Form.svelte';

	interface Props {
		open: boolean;
		title: string;
		/** Plain-English description of what will happen. */
		message: string;
		action?: string;
		/** Hidden form values sent with the confirmation, for example { id }. */
		values?: Record<string, string>;
		confirmLabel?: string;
		danger?: boolean;
		/** Small print under the message. Pass an empty string to hide it. */
		note?: string;
		onsuccess?: () => void;
	}

	let {
		open = $bindable(false),
		title,
		message,
		action = '?/delete',
		values = {},
		confirmLabel = 'Delete',
		danger = true,
		note,
		onsuccess
	}: Props = $props();
</script>

<Dialog bind:open {title} size="sm">
	<Form
		{action}
		onsuccess={() => {
			open = false;
			onsuccess?.();
		}}
	>
		{#snippet children({ pending })}
			{#each Object.entries(values) as [name, value] (name)}
				<input type="hidden" {name} {value} />
			{/each}
			<p class="text-lg">{message}</p>
			{#if note ?? (danger ? 'This cannot be undone.' : '')}
				<p class="mt-2 text-[0.95rem] text-muted">{note ?? 'This cannot be undone.'}</p>
			{/if}
			<div class="mt-8 flex flex-wrap justify-end gap-3">
				<button type="button" class="btn" onclick={() => (open = false)}>Cancel</button>
				<button type="submit" class="btn {danger ? 'btn-danger' : 'btn-primary'}" disabled={pending}>
					{pending ? 'Working…' : confirmLabel}
				</button>
			</div>
		{/snippet}
	</Form>
</Dialog>

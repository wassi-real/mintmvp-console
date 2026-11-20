<script lang="ts">
	import type { Snippet } from 'svelte';
	import { enhance } from '$app/forms';
	import { toasts } from '#lib/toast.svelte.ts';

	interface Props {
		/** Form action, for example "?/create". */
		action: string;
		children: Snippet<[{ pending: boolean; errors: Record<string, string> }]>;
		onsuccess?: (data: Record<string, unknown> | undefined) => void;
		/** Clear the inputs after a successful submission. */
		reset?: boolean;
		/** Show the server's confirmation message in the corner of the screen. */
		toast?: boolean;
		class?: string;
		enctype?: 'multipart/form-data';
		id?: string;
	}

	let {
		action,
		children,
		onsuccess,
		reset = true,
		toast = true,
		class: className = '',
		enctype,
		id
	}: Props = $props();

	let pending = $state(false);
	let message = $state('');
	let errors = $state<Record<string, string>>({});
</script>

<form
	method="POST"
	{action}
	{enctype}
	{id}
	class={className}
	use:enhance={() => {
		pending = true;
		message = '';
		errors = {};

		return async ({ result, update }) => {
			if (result.type === 'failure') {
				message = String(result.data?.message ?? 'Something went wrong. Please try again.');
				errors = (result.data?.errors as Record<string, string> | undefined) ?? {};
				pending = false;
				return;
			}
			if (result.type === 'error') {
				message = result.error?.message || 'Something went wrong. Please try again.';
				pending = false;
				return;
			}

			await update({ reset });
			pending = false;

			if (result.type === 'success') {
				if (toast && result.data?.message) toasts.show(String(result.data.message));
				onsuccess?.(result.data);
			}
		};
	}}
>
	{#if message}
		<p class="notice notice-bad mb-4" role="alert">{message}</p>
	{/if}
	{@render children({ pending, errors })}
</form>

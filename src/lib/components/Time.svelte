<script lang="ts">
	import { formatDateTimeLocal, formatDateTimeUtc, formatRelative } from '#lib/format.ts';

	interface Props {
		value: string | null | undefined;
		/** Show "3 hours ago" instead of the date and time. */
		relative?: boolean;
		fallback?: string;
	}

	let { value, relative = false, fallback = 'Never' }: Props = $props();

	// The server renders UTC so the first paint matches; the browser then switches to local time.
	let inBrowser = $state(false);
	$effect(() => {
		inBrowser = true;
	});

	const text = $derived(
		!value
			? fallback
			: !inBrowser
				? formatDateTimeUtc(value)
				: relative
					? formatRelative(value)
					: formatDateTimeLocal(value)
	);
</script>

{#if value}
	<time datetime={value} title={inBrowser ? formatDateTimeLocal(value) : undefined}>{text}</time>
{:else}
	<span class="text-muted">{fallback}</span>
{/if}

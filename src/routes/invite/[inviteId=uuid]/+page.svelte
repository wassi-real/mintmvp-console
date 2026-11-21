<script lang="ts">
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Invitation · MintMVP Console</title>
</svelte:head>

<main class="flex min-h-dvh items-center justify-center px-6 py-16">
	<div class="w-full max-w-lg rounded-block-xl border border-line bg-surface p-10 text-center">
		<p class="eyebrow">Invitation</p>
		<h1 class="mt-4 text-3xl">This invitation cannot be opened</h1>
		<p class="mt-3 text-lg text-muted">
			{#if data.failed}
				It may have expired, been cancelled, or belong to a different account. Sign in with the invited
				account, or ask for a new invitation.
			{/if}
		</p>
		<div class="mt-8 flex flex-wrap justify-center gap-3">
			<a href="/dashboard" class="btn btn-primary">Go to dashboard</a>
			<a href="/auth" class="btn">Switch account</a>
		</div>
	</div>
</main>

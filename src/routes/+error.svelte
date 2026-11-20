<script lang="ts">
	import { page } from '$app/state';

	const notFound = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{notFound ? 'Page not found' : 'Something went wrong'} · MintMVP Console</title>
</svelte:head>

<main class="flex min-h-dvh items-center justify-center px-6 py-16">
	<div class="w-full max-w-lg animate-rise rounded-block-xl border border-line bg-surface p-10 text-center">
		<p class="eyebrow">
			Error {page.status}
		</p>
		<h1 class="mt-4 text-3xl">{notFound ? 'We could not find that page' : 'Something went wrong'}</h1>
		<p class="mt-3 text-lg text-muted">
			{#if notFound}
				The link may be old, or the page may belong to a different workspace.
			{:else}
				{page.error?.message ?? 'Please try again in a moment.'}
			{/if}
		</p>
		<div class="mt-8 flex flex-wrap justify-center gap-3">
			<a href="/dashboard" class="btn btn-primary">Go to dashboard</a>
			<a href="/" class="btn">Home page</a>
		</div>
	</div>
</main>

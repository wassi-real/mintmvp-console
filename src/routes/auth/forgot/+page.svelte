<script lang="ts">
	import { enhance } from '$app/forms';
	import AuthShell from '#lib/components/AuthShell.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let pending = $state(false);
</script>

<svelte:head>
	<title>Reset password · MintMVP Console</title>
</svelte:head>

<AuthShell
	title="Reset your password"
	description="Enter your email address and we will send you a link to choose a new password."
>
	{#if form?.sent}
		<p class="notice notice-ok" role="status">
			If there is an account for <strong>{form.email}</strong>, a reset link is on its way. It can
			take a minute to arrive. Check your spam folder too.
		</p>
		<a href="/auth?mode=login" class="btn btn-block mt-6">Back to log in</a>
	{:else}
		{#if data.expired && !form?.message}
			<p class="notice notice-warn mb-5" role="status">
				That reset link has expired or was already used. Ask for a new one below.
			</p>
		{/if}
		{#if form?.message}
			<p class="notice notice-bad mb-5" role="alert">{form.message}</p>
		{/if}

		<form
			method="POST"
			class="grid gap-4"
			use:enhance={() => {
				pending = true;
				return async ({ update }) => {
					await update({ reset: false });
					pending = false;
				};
			}}
		>
			<div>
				<label class="label" for="email">Email address</label>
				<input
					id="email"
					name="email"
					class="input"
					type="email"
					autocomplete="email"
					required
					value={form?.email ?? ''}
				/>
			</div>
			<button type="submit" class="btn btn-primary btn-lg btn-block" disabled={pending}>
				{pending ? 'Sending…' : 'Send reset link'}
			</button>
		</form>
	{/if}

	{#snippet footer()}
		Remembered it? <a class="link text-fg" href="/auth?mode=login">Back to log in</a>
	{/snippet}
</AuthShell>

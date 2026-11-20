<script lang="ts">
	import { enhance } from '$app/forms';
	import AuthShell from '#lib/components/AuthShell.svelte';
	import { PASSWORD_MIN } from '#lib/constants.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	let pending = $state(false);
	let showPassword = $state(false);
</script>

<svelte:head>
	<title>Choose a new password · MintMVP Console</title>
</svelte:head>

<AuthShell
	title="Choose a new password"
	description={data.email ? `For ${data.email}.` : undefined}
>
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
			<label class="label" for="password">New password</label>
			<input
				id="password"
				name="password"
				class="input"
				type={showPassword ? 'text' : 'password'}
				autocomplete="new-password"
				required
				minlength={PASSWORD_MIN}
				maxlength="72"
				aria-describedby="password-hint"
			/>
			<p class="hint" id="password-hint">At least {PASSWORD_MIN} characters.</p>
		</div>
		<div>
			<label class="label" for="confirm">Type it again</label>
			<input
				id="confirm"
				name="confirm"
				class="input"
				type={showPassword ? 'text' : 'password'}
				autocomplete="new-password"
				required
				maxlength="72"
			/>
		</div>
		<label class="flex min-h-11 items-center gap-3">
			<input type="checkbox" class="checkbox" bind:checked={showPassword} />
			Show passwords
		</label>
		<button type="submit" class="btn btn-primary btn-lg btn-block" disabled={pending}>
			{pending ? 'Saving…' : 'Save new password'}
		</button>
	</form>
</AuthShell>

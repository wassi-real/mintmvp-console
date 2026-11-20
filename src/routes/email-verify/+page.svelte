<script lang="ts">
	import { enhance } from '$app/forms';
	import Mail from '@lucide/svelte/icons/mail';
	import AuthShell from '#lib/components/AuthShell.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let resending = $state(false);
	let checking = $state(false);
	let cooldown = $state(0);

	// A short wait between resend requests, so the button cannot be hammered.
	$effect(() => {
		if (cooldown <= 0) return;
		const timer = setTimeout(() => (cooldown -= 1), 1000);
		return () => clearTimeout(timer);
	});
</script>

<svelte:head>
	<title>Confirm your email · MintMVP Console</title>
</svelte:head>

<AuthShell title="Confirm your email address">
	<div class="flex items-start gap-4">
		<span class="flex size-14 shrink-0 items-center justify-center rounded-block-lg bg-surface-2">
			<Mail size={28} aria-hidden="true" />
		</span>
		<p class="text-lg">
			{#if data.email}
				We sent a confirmation email to <strong class="break-all">{data.email}</strong>. Open it
				and press <strong>Confirm email</strong> to continue.
			{:else}
				We sent you a confirmation email. Open it and press <strong>Confirm email</strong> to
				continue.
			{/if}
		</p>
	</div>

	{#if data.expired && !form}
		<p class="notice notice-warn mt-5" role="status">
			That confirmation link has expired or was already used. Send a new email below. If you already
			confirmed, you can simply log in.
		</p>
	{/if}
	{#if form?.message}
		<p class="notice notice-bad mt-5" role="alert">{form.message}</p>
	{/if}
	{#if form?.resent}
		<p class="notice notice-ok mt-5" role="status">A new email is on its way. Use the newest one.</p>
	{/if}

	<ol class="mt-7 grid gap-2.5 rounded-block-lg bg-surface-2 p-5 text-[0.95rem] text-muted">
		<li>1. Look for an email from MintMVP Console. It can take a minute to arrive.</li>
		<li>2. Not there? Check your spam or promotions folder.</li>
		<li>3. Press the button in the email, then come back here.</li>
	</ol>

	<form
		method="POST"
		action="?/code"
		class="mt-7 border-t border-line pt-7"
		use:enhance={() => {
			checking = true;
			return async ({ update }) => {
				await update({ reset: false });
				checking = false;
			};
		}}
	>
		{#if !data.email}
			<div class="mb-4">
				<label class="label" for="code-email">Email address</label>
				<input id="code-email" name="email" type="email" class="input" autocomplete="email" required />
			</div>
		{/if}
		<label class="label" for="token">Have a code in the email? Enter it here</label>
		<div class="flex gap-3">
			<input
				id="token"
				name="token"
				class="input mono tracking-[0.3em]"
				inputmode="numeric"
				autocomplete="one-time-code"
				pattern="[0-9 ]*"
				maxlength="10"
				placeholder="123456"
				required
			/>
			<button type="submit" class="btn btn-primary shrink-0" disabled={checking}>
				{checking ? 'Checking…' : 'Confirm'}
			</button>
		</div>
	</form>

	<div class="mt-7 flex flex-wrap items-center gap-3 border-t border-line pt-7">
		<form
			method="POST"
			action="?/resend"
			class="contents"
			use:enhance={() => {
				resending = true;
				return async ({ result, update }) => {
					await update({ reset: false });
					resending = false;
					if (result.type === 'success') cooldown = 60;
				};
			}}
		>
			{#if !data.email}
				<input
					name="email"
					type="email"
					class="input max-w-64"
					autocomplete="email"
					placeholder="you@example.com"
					aria-label="Email address"
					required
				/>
			{/if}
			<button type="submit" class="btn" disabled={resending || cooldown > 0}>
				{#if resending}
					Sending…
				{:else if cooldown > 0}
					Send again in {cooldown}s
				{:else}
					Send the email again
				{/if}
			</button>
		</form>

		<form method="POST" action="?/change">
			<button type="submit" class="btn btn-ghost">Use a different email</button>
		</form>
	</div>

	{#snippet footer()}
		Already confirmed? <a class="link text-fg" href="/auth?mode=login">Log in</a>
	{/snippet}
</AuthShell>

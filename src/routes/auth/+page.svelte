<script lang="ts">
	import { enhance } from '$app/forms';
	import AuthShell from '#lib/components/AuthShell.svelte';
	import { PASSWORD_MIN } from '#lib/constants.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	// After a failed submission, stay on the tab that was submitted.
	const mode = $derived(form?.mode === 'login' || form?.mode === 'signup' ? form.mode : data.mode);
	const errors = $derived((form?.errors ?? {}) as Record<string, string>);

	let pending = $state(false);
	let showPassword = $state(false);

	const nextQuery = $derived(data.next ? `&next=${encodeURIComponent(data.next)}` : '');
</script>

<svelte:head>
	<title>{mode === 'signup' ? 'Sign up' : 'Log in'} · MintMVP Console</title>
</svelte:head>

<AuthShell
	title={mode === 'signup' ? 'Create your account' : 'Log in'}
	description={mode === 'signup'
		? 'It takes about two minutes. You will confirm your email next.'
		: 'Welcome back. Enter your details to open your dashboard.'}
>
	<nav class="seg mb-7 w-full" aria-label="Log in or sign up">
		<a
			href="/auth?mode=login{nextQuery}"
			class="seg-item"
			aria-current={mode === 'login' ? 'page' : undefined}
		>
			Log in
		</a>
		<a
			href="/auth?mode=signup{nextQuery}"
			class="seg-item"
			aria-current={mode === 'signup' ? 'page' : undefined}
		>
			Sign up
		</a>
	</nav>

	{#if data.notice && !form?.message}
		<p class="notice notice-ok mb-5" role="status">{data.notice}</p>
	{/if}
	{#if form?.message}
		<p class="notice notice-bad mb-5" role="alert">{form.message}</p>
	{/if}

	{#key mode}
		<form
			method="POST"
			action="?/{mode}"
			class="grid animate-fade gap-5"
			use:enhance={() => {
				pending = true;
				return async ({ update }) => {
					await update({ reset: false });
					pending = false;
				};
			}}
		>
			<input type="hidden" name="next" value={data.next} />

			{#if mode === 'signup'}
				<div>
					<label class="label" for="full_name">Your name</label>
					<input
						id="full_name"
						name="full_name"
						class="input"
						type="text"
						autocomplete="name"
						required
						minlength="2"
						maxlength="80"
						value={form?.fullName ?? ''}
						aria-invalid={errors.full_name ? 'true' : undefined}
						aria-describedby={errors.full_name ? 'full_name-error' : undefined}
					/>
					{#if errors.full_name}
						<p class="field-error" id="full_name-error">{errors.full_name}</p>
					{/if}
				</div>
			{/if}

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
					aria-invalid={errors.email ? 'true' : undefined}
					aria-describedby={errors.email ? 'email-error' : undefined}
				/>
				{#if errors.email}
					<p class="field-error" id="email-error">{errors.email}</p>
				{/if}
			</div>

			<div>
				<div class="flex items-baseline justify-between gap-3">
					<label class="label" for="password">Password</label>
					{#if mode === 'login'}
						<a href="/auth/forgot" class="link mb-2 text-[0.9rem] text-muted">Forgot password?</a>
					{/if}
				</div>
				<div class="flex gap-2">
					<input
						id="password"
						name="password"
						class="input"
						type={showPassword ? 'text' : 'password'}
						autocomplete={mode === 'signup' ? 'new-password' : 'current-password'}
						required
						minlength={mode === 'signup' ? PASSWORD_MIN : undefined}
						maxlength="72"
						aria-invalid={errors.password ? 'true' : undefined}
						aria-describedby="password-help"
					/>
					<button
						type="button"
						class="btn shrink-0"
						aria-pressed={showPassword}
						onclick={() => (showPassword = !showPassword)}
					>
						{showPassword ? 'Hide' : 'Show'}
					</button>
				</div>
				<p id="password-help" class={errors.password ? 'field-error' : 'hint'}>
					{#if errors.password}
						{errors.password}
					{:else if mode === 'signup'}
						At least {PASSWORD_MIN} characters.
					{/if}
				</p>
			</div>

			<button type="submit" class="btn btn-primary btn-lg btn-block mt-2" disabled={pending}>
				{#if pending}
					Please wait…
				{:else}
					{mode === 'signup' ? 'Create account' : 'Log in'}
				{/if}
			</button>
		</form>
	{/key}

	{#snippet footer()}
		{#if mode === 'signup'}
			Already have an account? <a class="link text-fg" href="/auth?mode=login{nextQuery}">Log in</a>
		{:else}
			New here? <a class="link text-fg" href="/auth?mode=signup{nextQuery}">Create an account</a>
		{/if}
	{/snippet}
</AuthShell>

<script lang="ts">
	import { createClient } from '$lib/supabase/client';
	import { goto } from '$app/navigation';
	import { AlertCircle, ArrowRight, Eye, EyeOff, Loader, Lock, Mail } from 'lucide-svelte';

	const supabase = createClient();

	let email = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let loading = $state(false);
	let error = $state('');
	let emailInput = $state<HTMLInputElement | null>(null);

	$effect(() => {
		emailInput?.focus();
	});

	async function handleLogin(e: Event) {
		e.preventDefault();
		if (loading) return;

		loading = true;
		error = '';

		const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

		if (authError) {
			error = authError.message;
			loading = false;
			return;
		}

		// Reload server data so the session cookie is picked up before the dashboard renders.
		await goto('/dashboard', { invalidateAll: true });
	}
</script>

<svelte:head>
	<title>Sign in · MintMVP Console</title>
</svelte:head>

<div class="login-shell relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-10">
	<!-- Ambient background: animated with transform/opacity only, so it never costs layout -->
	<div aria-hidden="true" class="pointer-events-none absolute inset-0 overflow-hidden">
		<span class="glow glow-a"></span>
		<span class="glow glow-b"></span>
		<span class="grid-lines absolute inset-0"></span>
	</div>

	<div class="relative w-full max-w-md">
		<!-- Brand -->
		<div class="reveal mb-8 flex flex-col items-center text-center" style="--delay: 0ms">
			<img
				src="/favicon.png"
				alt="MintMVP"
				width="64"
				height="64"
				fetchpriority="high"
				class="logo h-16 w-16 rounded-2xl border border-border shadow-lg"
			/>
			<h1 class="mt-4 text-3xl font-bold tracking-tight text-foreground">MintMVP</h1>
			<p class="mt-1 text-base text-muted-foreground">Client Console</p>
		</div>

		<form
			onsubmit={handleLogin}
			class="reveal rounded-2xl border border-border bg-card/80 p-6 shadow-2xl backdrop-blur-xl sm:p-8"
			style="--delay: 70ms"
		>
			<h2 class="text-xl font-semibold text-foreground">Sign in</h2>
			<p class="mt-1 text-sm text-muted-foreground">Welcome back. Enter your details to continue.</p>

			{#if error}
				<div
					class="error-banner mt-5 flex items-start gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-red-300"
					role="alert"
				>
					<AlertCircle size={18} class="mt-0.5 shrink-0" />
					<span>{error}</span>
				</div>
			{/if}

			<div class="mt-6 space-y-4">
				<div>
					<label for="email" class="mb-1.5 block text-sm font-medium text-foreground">Email</label>
					<div class="field">
						<Mail size={18} class="field-icon" />
						<input
							id="email"
							type="email"
							bind:this={emailInput}
							bind:value={email}
							required
							autocomplete="email"
							placeholder="you@company.com"
							class="w-full rounded-lg border border-input bg-background py-3 pl-11 pr-4 text-base text-foreground transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
						/>
					</div>
				</div>

				<div>
					<label for="password" class="mb-1.5 block text-sm font-medium text-foreground">
						Password
					</label>
					<div class="field">
						<Lock size={18} class="field-icon" />
						<input
							id="password"
							type={showPassword ? 'text' : 'password'}
							bind:value={password}
							required
							autocomplete="current-password"
							placeholder="Enter your password"
							class="w-full rounded-lg border border-input bg-background py-3 pl-11 pr-12 text-base text-foreground transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40"
						/>
						<button
							type="button"
							onclick={() => (showPassword = !showPassword)}
							class="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
							aria-label={showPassword ? 'Hide password' : 'Show password'}
						>
							{#if showPassword}<EyeOff size={18} />{:else}<Eye size={18} />{/if}
						</button>
					</div>
				</div>

				<button
					type="submit"
					disabled={loading}
					class="submit group flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
				>
					{#if loading}
						<Loader size={18} class="animate-spin" />
						Signing in…
					{:else}
						Sign In
						<ArrowRight
							size={18}
							class="transition-transform duration-200 group-hover:translate-x-0.5"
						/>
					{/if}
				</button>
			</div>
		</form>

		<p class="reveal mt-6 text-center text-sm text-muted-foreground" style="--delay: 140ms">
			Trouble signing in? Contact your project owner.
		</p>
	</div>
</div>

<style>
	.login-shell {
		background:
			radial-gradient(1200px 600px at 50% -10%, rgba(63, 63, 70, 0.35), transparent 70%),
			var(--color-background);
	}

	.grid-lines {
		background-image:
			linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
			linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
		background-size: 56px 56px;
		mask-image: radial-gradient(closest-side at 50% 40%, black, transparent);
	}

	.glow {
		position: absolute;
		border-radius: 9999px;
		filter: blur(90px);
		opacity: 0.5;
		will-change: transform;
	}

	.glow-a {
		width: 26rem;
		height: 26rem;
		top: -6rem;
		left: -6rem;
		background: rgba(34, 197, 94, 0.16);
		animation: drift-a 18s ease-in-out infinite alternate;
	}

	.glow-b {
		width: 24rem;
		height: 24rem;
		right: -7rem;
		bottom: -7rem;
		background: rgba(124, 58, 237, 0.16);
		animation: drift-b 22s ease-in-out infinite alternate;
	}

	@keyframes drift-a {
		from {
			transform: translate3d(0, 0, 0) scale(1);
		}
		to {
			transform: translate3d(3rem, 2rem, 0) scale(1.12);
		}
	}

	@keyframes drift-b {
		from {
			transform: translate3d(0, 0, 0) scale(1.08);
		}
		to {
			transform: translate3d(-2.5rem, -2rem, 0) scale(1);
		}
	}

	.reveal {
		animation: reveal 0.45s cubic-bezier(0.22, 1, 0.36, 1) both;
		animation-delay: var(--delay, 0ms);
	}

	@keyframes reveal {
		from {
			opacity: 0;
			transform: translate3d(0, 14px, 0);
		}
		to {
			opacity: 1;
			transform: translate3d(0, 0, 0);
		}
	}

	.logo {
		animation: logo-in 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	@keyframes logo-in {
		from {
			opacity: 0;
			transform: scale(0.82) translate3d(0, 8px, 0);
		}
		to {
			opacity: 1;
			transform: scale(1) translate3d(0, 0, 0);
		}
	}

	.error-banner {
		animation: shake 0.32s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
	}

	@keyframes shake {
		0%,
		100% {
			transform: translate3d(0, 0, 0);
		}
		25% {
			transform: translate3d(-5px, 0, 0);
		}
		75% {
			transform: translate3d(5px, 0, 0);
		}
	}

	.field {
		position: relative;
	}

	.field :global(.field-icon) {
		position: absolute;
		left: 0.875rem;
		top: 50%;
		transform: translateY(-50%);
		color: var(--color-muted-foreground);
		pointer-events: none;
	}

	.submit:not(:disabled):active {
		transform: scale(0.985);
	}

	@media (prefers-reduced-motion: reduce) {
		.glow,
		.reveal,
		.logo,
		.error-banner {
			animation: none;
		}
		.reveal,
		.logo {
			opacity: 1;
			transform: none;
		}
	}
</style>

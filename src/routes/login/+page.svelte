<script lang="ts">
	import { createClient } from '$lib/supabase/client';
	import { goto } from '$app/navigation';

	const supabase = createClient();

	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let error = $state('');

	async function handleLogin(e: Event) {
		e.preventDefault();
		loading = true;
		error = '';

		const { error: authError } = await supabase.auth.signInWithPassword({
			email,
			password
		});

		if (authError) {
			error = authError.message;
			loading = false;
			return;
		}

		goto('/dashboard');
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-background px-4">
	<div class="w-full max-w-md">
		<div class="mb-10 text-center">
			<h1 class="text-4xl font-bold tracking-tight text-foreground">MintMVP</h1>
			<p class="mt-2 text-lg text-muted-foreground">Client Console</p>
		</div>

		<form onsubmit={handleLogin} class="rounded-2xl border border-border bg-card p-8">
			<h2 class="mb-6 text-2xl font-semibold text-foreground">Sign in</h2>

			{#if error}
				<div class="mb-4 rounded-lg bg-red-900/30 px-4 py-3 text-base text-red-300">
					{error}
				</div>
			{/if}

			<div class="space-y-5">
				<div>
					<label for="email" class="mb-2 block text-base font-medium text-foreground">
						Email
					</label>
					<input
						id="email"
						type="email"
						bind:value={email}
						required
						class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring"
						placeholder="you@company.com"
					/>
				</div>

				<div>
					<label for="password" class="mb-2 block text-base font-medium text-foreground">
						Password
					</label>
					<input
						id="password"
						type="password"
						bind:value={password}
						required
						class="w-full rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring"
						placeholder="Enter your password"
					/>
				</div>

				<button
					type="submit"
					disabled={loading}
					class="w-full rounded-lg bg-primary px-6 py-4 text-lg font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
				>
					{loading ? 'Signing in...' : 'Sign In'}
				</button>
			</div>
		</form>
	</div>
</div>

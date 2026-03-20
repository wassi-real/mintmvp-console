<script lang="ts">
	import { LayoutDashboard, FolderKanban, LogOut, Menu, X } from 'lucide-svelte';
	import { createClient } from '$lib/supabase/client';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	const supabase = createClient();
	let mobileMenuOpen = $state(false);

	async function logout() {
		await supabase.auth.signOut();
		goto('/login');
	}

	function isActive(path: string) {
		return $page.url.pathname.startsWith(path);
	}

	function closeMobile() {
		mobileMenuOpen = false;
	}
</script>

<nav class="fixed inset-x-0 top-0 z-50 flex h-16 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
	<!-- Brand -->
	<div class="flex items-center gap-3 sm:gap-8">
		<a href="/dashboard" class="flex items-center gap-2.5 shrink-0" onclick={closeMobile}>
			<img src="/favicon.png" alt="MintMVP logo" class="h-8 w-8 rounded-lg" />
			<span class="text-lg font-bold tracking-tight text-foreground">Console</span>
		</a>

		<!-- Desktop nav links -->
		<div class="hidden items-center gap-1 sm:flex">
			<a
				href="/dashboard"
				class="flex items-center gap-2 rounded-lg px-4 py-2 text-base font-medium transition-colors {isActive('/dashboard')
					? 'bg-secondary text-foreground'
					: 'text-muted-foreground hover:bg-secondary hover:text-foreground'}"
			>
				<LayoutDashboard size={20} />
				Dashboard
			</a>
			<a
				href="/projects"
				class="flex items-center gap-2 rounded-lg px-4 py-2 text-base font-medium transition-colors {isActive('/projects')
					? 'bg-secondary text-foreground'
					: 'text-muted-foreground hover:bg-secondary hover:text-foreground'}"
			>
				<FolderKanban size={20} />
				Projects
			</a>
		</div>
	</div>

	<!-- Right side -->
	<div class="flex items-center gap-2">
		<!-- Desktop sign out -->
		<button
			onclick={logout}
			class="hidden items-center gap-2 rounded-lg px-4 py-2 text-base font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground sm:flex"
		>
			<LogOut size={20} />
			Sign Out
		</button>

		<!-- Mobile hamburger -->
		<button
			onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
			class="flex items-center justify-center rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground sm:hidden"
			aria-label="Toggle menu"
		>
			{#if mobileMenuOpen}
				<X size={24} />
			{:else}
				<Menu size={24} />
			{/if}
		</button>
	</div>
</nav>

<!-- Mobile dropdown menu -->
{#if mobileMenuOpen}
	<div class="fixed top-16 left-0 right-0 z-40 border-b border-border bg-card shadow-xl sm:hidden">
		<div class="flex flex-col p-4 gap-1">
			<a
				href="/dashboard"
				onclick={closeMobile}
				class="flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors {isActive('/dashboard')
					? 'bg-secondary text-foreground'
					: 'text-muted-foreground hover:bg-secondary hover:text-foreground'}"
			>
				<LayoutDashboard size={20} />
				Dashboard
			</a>
			<a
				href="/projects"
				onclick={closeMobile}
				class="flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors {isActive('/projects')
					? 'bg-secondary text-foreground'
					: 'text-muted-foreground hover:bg-secondary hover:text-foreground'}"
			>
				<FolderKanban size={20} />
				Projects
			</a>
			<div class="mt-2 border-t border-border pt-2">
				<button
					onclick={logout}
					class="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-base font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
				>
					<LogOut size={20} />
					Sign Out
				</button>
			</div>
		</div>
	</div>
{/if}

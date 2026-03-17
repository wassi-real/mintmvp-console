<script lang="ts">
	import {
		LayoutDashboard,
		FileText,
		ListTodo,
		FlaskConical,
		Rocket,
		AlertTriangle,
		Activity,
		X
	} from 'lucide-svelte';
	import { page } from '$app/stores';

	let {
		projectId,
		mobileOpen = false,
		onClose
	}: { projectId: string; mobileOpen?: boolean; onClose?: () => void } = $props();

	const linkDefs = [
		{ path: '', label: 'Overview', icon: LayoutDashboard, exact: true },
		{ path: '/specs', label: 'Specs', icon: FileText },
		{ path: '/tasks', label: 'Tasks', icon: ListTodo },
		{ path: '/tests', label: 'Tests', icon: FlaskConical },
		{ path: '/deployments', label: 'Deployments', icon: Rocket },
		{ path: '/incidents', label: 'Incidents', icon: AlertTriangle },
		{ path: '/activity', label: 'Activity', icon: Activity }
	];

	function getHref(path: string) {
		return `/projects/${projectId}${path}`;
	}

	function isActive(path: string, exact?: boolean) {
		const href = getHref(path);
		if (exact) return $page.url.pathname === href;
		return $page.url.pathname.startsWith(href);
	}

	function handleNavClick() {
		onClose?.();
	}
</script>

<!-- Desktop sidebar: always visible on lg+ -->
<aside class="hidden lg:flex w-60 shrink-0 flex-col gap-1 border-r border-border bg-card p-4">
	{#each linkDefs as link}
		<a
			href={getHref(link.path)}
			class="flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors {isActive(link.path, link.exact)
				? 'bg-secondary text-foreground'
				: 'text-muted-foreground hover:bg-secondary hover:text-foreground'}"
		>
			<link.icon size={20} />
			{link.label}
		</a>
	{/each}
</aside>

<!-- Mobile sidebar: slide-in overlay -->
{#if mobileOpen}
	<!-- Backdrop -->
	<button
		class="fixed inset-0 z-40 bg-black/60 lg:hidden"
		onclick={() => onClose?.()}
		aria-label="Close sidebar"
	></button>

	<!-- Panel -->
	<aside class="fixed inset-y-0 left-0 z-50 flex w-72 flex-col gap-1 border-r border-border bg-card p-4 shadow-2xl lg:hidden">
		<div class="mb-4 flex items-center justify-between">
			<span class="text-base font-semibold text-foreground">Navigation</span>
			<button
				onclick={() => onClose?.()}
				class="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
				aria-label="Close"
			>
				<X size={20} />
			</button>
		</div>
		{#each linkDefs as link}
			<a
				href={getHref(link.path)}
				onclick={handleNavClick}
				class="flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors {isActive(link.path, link.exact)
					? 'bg-secondary text-foreground'
					: 'text-muted-foreground hover:bg-secondary hover:text-foreground'}"
			>
				<link.icon size={20} />
				{link.label}
			</a>
		{/each}
	</aside>
{/if}

<script lang="ts">
	import ProjectSidebar from '$lib/components/ProjectSidebar.svelte';
	import { Menu } from 'lucide-svelte';
	import { untrack } from 'svelte';
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import { browser } from '$app/environment';
	import { GITHUB_SYNC_INTERVAL_MS } from '$lib/github-sync-constants';
	import { persistSidebarCollapsed } from '$lib/sidebar-state';

	let { children, data } = $props();

	let sidebarOpen = $state(false);
	// Seeded from the cookie the server rendered with, so the rail never flashes on load.
	let collapsed = $state(untrack(() => data.sidebarCollapsed));

	function toggleCollapsed() {
		collapsed = !collapsed;
		persistSidebarCollapsed(collapsed);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key !== '[' || e.metaKey || e.ctrlKey || e.altKey) return;
		const el = e.target as HTMLElement | null;
		if (el?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el?.tagName ?? '')) return;
		e.preventDefault();
		toggleCollapsed();
	}

	// Pull GitHub → DB in the background. Running this in the layout `load` made every project
	// navigation wait on GitHub's API; here the page is already interactive.
	$effect(() => {
		if (!browser) return;
		const projectId = data.project.id;
		let cancelled = false;

		async function sync() {
			if (document.visibilityState !== 'visible') return;
			try {
				const res = await fetch(`/projects/${projectId}/github/sync`, { method: 'POST' });
				if (cancelled || !res.ok) return;
				const body = await res.json();
				if (body?.changed) await invalidateAll();
			} catch {
				// Background refresh — a failure here must never surface to the user.
			}
		}

		void sync();
		const timer = setInterval(sync, GITHUB_SYNC_INTERVAL_MS);
		return () => {
			cancelled = true;
			clearInterval(timer);
		};
	});

	const sectionLabel = $derived.by(() => {
		const path = $page.url.pathname;
		if (path.endsWith('/pipeline')) return 'Pipeline';
		if (path.endsWith('/specs')) return 'Specs';
		if (path.includes('/milestone')) return 'Milestones';
		if (path.endsWith('/tasks')) return 'Tasks';
		if (path.endsWith('/tests')) return 'Tests';
		if (path.endsWith('/environments')) return 'Environments';
		if (path.endsWith('/monitoring')) return 'Monitoring';
		if (path.endsWith('/deploy-logs')) return 'Deploy logs';
		if (path.endsWith('/incidents')) return 'Incidents';
		if (path.endsWith('/activity')) return 'Activity';
		if (path.endsWith('/finance')) return 'Finance';
		if (path.endsWith('/api')) return 'API';
		if (path.endsWith('/reports')) return 'Reports';
		if (path.includes('/settings/github')) return 'GitHub Integration';
		if (path.endsWith('/settings')) return 'Settings';
		if (path.endsWith('/github')) return 'GitHub';
		if (path.endsWith('/ci')) return 'CI / CD';
		return 'Overview';
	});
</script>

<svelte:window onkeydown={onKeydown} />

<div
	class="flex h-full flex-1 overflow-hidden"
	style:--sidebar-w={collapsed ? '4.25rem' : '15rem'}
>
	<ProjectSidebar
		projectId={data.project.id}
		{collapsed}
		onToggleCollapse={toggleCollapsed}
		mobileOpen={sidebarOpen}
		onClose={() => (sidebarOpen = false)}
	/>

	<div class="content-pane flex min-w-0 flex-1 flex-col overflow-hidden">
		<!-- Mobile top bar with sidebar toggle -->
		<div
			class="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card px-4 py-3 lg:hidden"
		>
			<button
				onclick={() => (sidebarOpen = true)}
				class="flex items-center gap-2 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
				aria-label="Open sidebar"
			>
				<Menu size={22} />
			</button>
			<div class="min-w-0">
				<p class="truncate text-xs font-medium text-muted-foreground">{data.project.name}</p>
				<p class="truncate text-base font-semibold leading-tight text-foreground">{sectionLabel}</p>
			</div>
		</div>

		<div class="scroll-pane relative flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
			{@render children()}
		</div>
	</div>
</div>

<style>
	.scroll-pane {
		scrollbar-gutter: stable;
		overscroll-behavior: contain;
	}

	@media (min-width: 1024px) {
		.content-pane {
			padding-left: var(--sidebar-w, 15rem);
			transition: padding-left 220ms cubic-bezier(0.22, 1, 0.36, 1);
			will-change: padding-left;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.content-pane {
			transition: none;
		}
	}
</style>

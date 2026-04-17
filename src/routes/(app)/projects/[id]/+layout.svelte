<script lang="ts">
	import ProjectSidebar from '$lib/components/ProjectSidebar.svelte';
	import { Menu } from 'lucide-svelte';
	import { page } from '$app/stores';
	import { invalidateAll } from '$app/navigation';
	import { browser } from '$app/environment';
	import { GITHUB_SYNC_INTERVAL_MS } from '$lib/github-sync-constants';

	let { children, data } = $props();
	let sidebarOpen = $state(false);

	$effect(() => {
		if (!browser) return;
		const id = setInterval(() => {
			if (document.visibilityState === 'visible') void invalidateAll();
		}, GITHUB_SYNC_INTERVAL_MS);
		return () => clearInterval(id);
	});

	const sectionLabel = $derived.by(() => {
		const path = $page.url.pathname;
		if (path.endsWith('/pipeline')) return 'Pipeline';
		if (path.endsWith('/specs')) return 'Specs';
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

<div class="flex h-full flex-1 overflow-hidden">
	<ProjectSidebar
		projectId={data.project.id}
		mobileOpen={sidebarOpen}
		onClose={() => (sidebarOpen = false)}
	/>

	<div class="flex min-w-0 flex-1 flex-col overflow-hidden lg:pl-60">
		<!-- Mobile top bar with sidebar toggle -->
		<div class="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card px-4 py-3 lg:hidden">
			<button
				onclick={() => (sidebarOpen = true)}
				class="flex items-center gap-2 rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
				aria-label="Open sidebar"
			>
				<Menu size={22} />
			</button>
			<div>
				<p class="text-xs text-muted-foreground font-medium">{data.project.name}</p>
				<p class="text-base font-semibold text-foreground leading-tight">{sectionLabel}</p>
			</div>
		</div>

		<div class="relative flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
			{@render children()}
		</div>
	</div>
</div>

<script lang="ts">
	import ProjectSidebar from '$lib/components/ProjectSidebar.svelte';
	import { Menu } from 'lucide-svelte';
	import { page } from '$app/stores';

	let { children, data } = $props();
	let sidebarOpen = $state(false);

	const sectionLabel = $derived.by(() => {
		const path = $page.url.pathname;
		if (path.endsWith('/specs')) return 'Specs';
		if (path.endsWith('/tasks')) return 'Tasks';
		if (path.endsWith('/tests')) return 'Tests';
		if (path.endsWith('/deployments')) return 'Deployments';
		if (path.endsWith('/incidents')) return 'Incidents';
		if (path.endsWith('/activity')) return 'Activity';
		return 'Overview';
	});
</script>

<div class="flex flex-1 overflow-hidden">
	<ProjectSidebar
		projectId={data.project.id}
		mobileOpen={sidebarOpen}
		onClose={() => (sidebarOpen = false)}
	/>

	<div class="flex flex-1 flex-col overflow-auto">
		<!-- Mobile top bar with sidebar toggle -->
		<div class="flex items-center gap-3 border-b border-border bg-card px-4 py-3 lg:hidden">
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

		<div class="flex-1 p-4 sm:p-6 lg:p-8">
			{@render children()}
		</div>
	</div>
</div>

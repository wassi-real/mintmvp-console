<script lang="ts">
	import {
		LayoutDashboard,
		FileText,
		ListTodo,
		FlaskConical,
		AlertTriangle,
		Activity,
		BookOpen,
		Terminal,
		Workflow,
		Globe,
		HeartPulse,
		DollarSign,
		Landmark,
		Github,
		Play,
		Settings2,
		ScrollText,
		X
	} from 'lucide-svelte';
	import { page } from '$app/stores';

	let {
		projectId,
		mobileOpen = false,
		onClose
	}: { projectId: string; mobileOpen?: boolean; onClose?: () => void } = $props();

	type NavLink = { path: string; label: string; icon: any; exact?: boolean };
	type NavGroup = { heading: string; links: NavLink[] };

	const navGroups: (NavLink | NavGroup)[] = [
		{ path: '', label: 'Overview', icon: LayoutDashboard, exact: true },
		{ path: '/pipeline', label: 'Pipeline', icon: Workflow },
		{
			heading: 'Planning',
			links: [
				{ path: '/reports', label: 'Reports', icon: BookOpen },
				{ path: '/specs', label: 'Specs', icon: FileText },
				{ path: '/milestone', label: 'Milestones', icon: Landmark },
				{ path: '/tasks', label: 'Tasks', icon: ListTodo }
			]
		},
		{
			heading: 'Development',
			links: [
				{ path: '/github', label: 'GitHub', icon: Github },
				{ path: '/tests', label: 'Tests', icon: FlaskConical },
				{ path: '/ci', label: 'CI / CD', icon: Play },
				{ path: '/environments', label: 'Environments', icon: Globe }
			]
		},
		{
			heading: 'Operations',
			links: [
				{ path: '/monitoring', label: 'Monitoring', icon: HeartPulse },
				{ path: '/deploy-logs', label: 'Deploy logs', icon: ScrollText },
				{ path: '/incidents', label: 'Incidents', icon: AlertTriangle },
				{ path: '/activity', label: 'Activity', icon: Activity }
			]
		},
		{ path: '/finance', label: 'Finance', icon: DollarSign },
		{ path: '/api', label: 'API', icon: Terminal },
		{ path: '/settings', label: 'Settings', icon: Settings2 }
	];

	function isGroup(item: NavLink | NavGroup): item is NavGroup {
		return 'heading' in item;
	}

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

{#snippet navItem(link: NavLink)}
	<a
		href={getHref(link.path)}
		onclick={handleNavClick}
		class="flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors {isActive(link.path, link.exact)
			? 'bg-secondary text-foreground'
			: 'text-muted-foreground hover:bg-secondary hover:text-foreground'}"
	>
		<link.icon size={18} />
		{link.label}
	</a>
{/snippet}

{#snippet navContent()}
	{#each navGroups as item}
		{#if isGroup(item)}
			<div class="mt-5 first:mt-0">
				<p class="mb-1.5 px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/60">{item.heading}</p>
				<div class="flex flex-col gap-0.5">
					{#each item.links as link}
						{@render navItem(link)}
					{/each}
				</div>
			</div>
		{:else}
			{@render navItem(item)}
		{/if}
	{/each}
{/snippet}

<!-- Desktop sidebar -->
<aside class="fixed top-16 bottom-0 left-0 hidden w-60 border-r border-border bg-card lg:flex">
	<div class="flex w-full flex-col gap-0.5 overflow-y-auto p-3">
		{@render navContent()}
	</div>
</aside>

<!-- Mobile sidebar -->
{#if mobileOpen}
	<button
		class="fixed inset-x-0 top-16 bottom-0 z-40 bg-black/60 lg:hidden"
		onclick={() => onClose?.()}
		aria-label="Close sidebar"
	></button>

	<aside class="fixed top-16 bottom-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-card shadow-2xl lg:hidden">
		<div class="mb-2 flex items-center justify-between px-4 pt-4">
			<span class="text-sm font-semibold text-foreground">Navigation</span>
			<button
				onclick={() => onClose?.()}
				class="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
				aria-label="Close"
			>
				<X size={18} />
			</button>
		</div>
		<div class="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4">
			{@render navContent()}
		</div>
	</aside>
{/if}

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
		PanelLeftClose,
		PanelLeftOpen,
		X
	} from 'lucide-svelte';
	import { page } from '$app/stores';
	import { fade, fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';

	let {
		projectId,
		collapsed = false,
		onToggleCollapse,
		mobileOpen = false,
		onClose
	}: {
		projectId: string;
		collapsed?: boolean;
		onToggleCollapse?: () => void;
		mobileOpen?: boolean;
		onClose?: () => void;
	} = $props();

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
</script>

<!-- `rail` = collapsed icon-only mode; labels stay in the DOM so widths animate instead of snapping -->
{#snippet navItem(link: NavLink, rail: boolean)}
	{@const active = isActive(link.path, link.exact)}
	<a
		href={getHref(link.path)}
		onclick={() => onClose?.()}
		title={rail ? link.label : undefined}
		aria-current={active ? 'page' : undefined}
		class="nav-item group relative flex items-center rounded-lg py-2.5 text-sm font-medium {rail
			? 'justify-center px-0'
			: 'gap-3 px-3'} {active
			? 'bg-secondary text-foreground'
			: 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'}"
	>
		{#if active}
			<span class="active-bar" aria-hidden="true"></span>
		{/if}
		<link.icon size={18} class="shrink-0" />
		<span class="label" class:label-hidden={rail}>{link.label}</span>
	</a>
{/snippet}

{#snippet navContent(rail: boolean)}
	{#each navGroups as item}
		{#if isGroup(item)}
			<div class="mt-4 first:mt-0">
				{#if rail}
					<div class="mx-auto mb-2 h-px w-7 bg-border" aria-hidden="true"></div>
				{:else}
					<p
						class="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60"
					>
						{item.heading}
					</p>
				{/if}
				<div class="flex flex-col gap-0.5">
					{#each item.links as link}
						{@render navItem(link, rail)}
					{/each}
				</div>
			</div>
		{:else}
			{@render navItem(item, rail)}
		{/if}
	{/each}
{/snippet}

<!-- Desktop sidebar -->
<aside
	class="sidebar fixed bottom-0 left-0 top-16 z-30 hidden flex-col border-r border-border bg-card lg:flex"
	aria-label="Project navigation"
>
	<div class="flex flex-1 flex-col gap-0.5 overflow-y-auto overflow-x-hidden p-2.5">
		{@render navContent(collapsed)}
	</div>

	<div class="border-t border-border p-2">
		<button
			type="button"
			onclick={() => onToggleCollapse?.()}
			title="{collapsed ? 'Expand' : 'Collapse'} sidebar  ( [ )"
			aria-label="{collapsed ? 'Expand' : 'Collapse'} sidebar"
			aria-expanded={!collapsed}
			class="flex w-full items-center rounded-lg py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground {collapsed
				? 'justify-center px-0'
				: 'gap-3 px-3'}"
		>
			{#if collapsed}
				<PanelLeftOpen size={18} class="shrink-0" />
			{:else}
				<PanelLeftClose size={18} class="shrink-0" />
			{/if}
			<span class="label" class:label-hidden={collapsed}>Collapse</span>
		</button>
	</div>
</aside>

<!-- Mobile drawer -->
{#if mobileOpen}
	<button
		class="fixed inset-x-0 bottom-0 top-16 z-40 bg-black/60 lg:hidden"
		onclick={() => onClose?.()}
		aria-label="Close sidebar"
		transition:fade={{ duration: 150 }}
	></button>

	<aside
		class="fixed bottom-0 left-0 top-16 z-50 flex w-72 flex-col border-r border-border bg-card shadow-2xl lg:hidden"
		aria-label="Project navigation"
		transition:fly={{ x: -288, duration: 220, easing: cubicOut, opacity: 1 }}
	>
		<div class="flex items-center justify-between px-4 py-3">
			<span class="text-sm font-semibold text-foreground">Navigation</span>
			<button
				onclick={() => onClose?.()}
				class="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
				aria-label="Close"
			>
				<X size={18} />
			</button>
		</div>
		<div class="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4">
			{@render navContent(false)}
		</div>
	</aside>
{/if}

<style>
	.sidebar {
		/* --sidebar-w is owned by the project layout so the content pane can animate in lockstep */
		width: var(--sidebar-w, 15rem);
		transition: width 220ms cubic-bezier(0.22, 1, 0.36, 1);
		will-change: width;
	}

	.nav-item {
		transition:
			background-color 0.15s ease,
			color 0.15s ease,
			padding 220ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.label {
		white-space: nowrap;
		overflow: hidden;
		opacity: 1;
		max-width: 12rem;
		transition:
			opacity 140ms ease,
			max-width 220ms cubic-bezier(0.22, 1, 0.36, 1);
	}

	.label-hidden {
		opacity: 0;
		max-width: 0;
	}

	.active-bar {
		position: absolute;
		left: 0;
		top: 50%;
		height: 1.15rem;
		width: 2px;
		border-radius: 0 2px 2px 0;
		background: var(--color-foreground);
		transform: translateY(-50%);
		animation: bar-in 200ms cubic-bezier(0.22, 1, 0.36, 1) both;
	}

	@keyframes bar-in {
		from {
			opacity: 0;
			transform: translateY(-50%) scaleY(0.3);
		}
		to {
			opacity: 1;
			transform: translateY(-50%) scaleY(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.sidebar,
		.nav-item,
		.label {
			transition: none;
		}
		.active-bar {
			animation: none;
		}
	}
</style>

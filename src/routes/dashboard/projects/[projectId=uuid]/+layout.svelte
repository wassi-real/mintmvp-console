<script lang="ts">
	import Activity from '@lucide/svelte/icons/activity';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Bot from '@lucide/svelte/icons/bot';
	import HeartPulse from '@lucide/svelte/icons/heart-pulse';
	import ListTodo from '@lucide/svelte/icons/list-todo';
	import NotebookText from '@lucide/svelte/icons/notebook-text';
	import Settings from '@lucide/svelte/icons/settings';
	import SquareKanban from '@lucide/svelte/icons/square-kanban';
	import Sun from '@lucide/svelte/icons/sun';
	import Workflow from '@lucide/svelte/icons/workflow';
	import { page } from '$app/state';
	import Badge from '#lib/components/Badge.svelte';
	import { projectStatus } from '#lib/constants.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const base = $derived(`/dashboard/projects/${data.project.id}`);
	const path = $derived(page.url.pathname);
	const view = $derived(page.url.searchParams.get('view'));

	interface NavLink {
		href: string;
		label: string;
		icon: typeof Activity;
		exact?: boolean;
		/** Not current when ?view= has this value. */
		not?: string;
		/** Only current when ?view= has this value. */
		only?: string;
		count?: number;
		alert?: boolean;
	}
	interface NavGroup {
		title: string;
		/** Hidden from people with view-only access. */
		staff?: boolean;
		links: NavLink[];
	}

	const groups = $derived(
		([
			{
				title: 'Work',
				links: [
					{ href: base, label: 'Today', icon: Sun, exact: true, count: data.counts.needsYou, alert: true },
					{ href: `${base}/work`, label: 'Work', icon: Workflow, count: data.counts.moving },
					{ href: `${base}/tasks`, label: 'Tasks', icon: ListTodo, not: 'board' },
					{ href: `${base}/tasks?view=board`, label: 'Board', icon: SquareKanban, only: 'board' },
					{ href: `${base}/reports`, label: 'Reports', icon: NotebookText },
					{ href: `${base}/activity`, label: 'History', icon: Activity },
					{ href: `${base}/monitoring`, label: 'Monitoring', icon: HeartPulse }
				]
			},
			{
				title: 'Setup',
				staff: true,
				links: [
					{ href: `${base}/api-keys`, label: 'Connect agent', icon: Bot },
					{ href: `${base}/settings`, label: 'Project settings', icon: Settings }
				]
			}
		] satisfies NavGroup[] as NavGroup[]).filter((group) => !group.staff || data.canEdit)
	);

	function isCurrent(link: NavLink): boolean {
		const target = link.href.split('?')[0];
		if (link.exact) return path === target;
		if (!(path === target || path.startsWith(`${target}/`))) return false;
		if (link.only) return view === link.only && path === target;
		if (link.not) return !(view === link.not && path === target);
		return true;
	}

	const allLinks = $derived(groups.flatMap((group) => group.links));
</script>

<!-- Project sidebar (desktop) -->
<aside class="hidden w-[17rem] shrink-0 flex-col border-r border-line lg:flex">
	<div class="border-b border-line p-4">
		<a href="/dashboard/projects" class="btn btn-ghost btn-sm -ml-2 text-muted">
			<ArrowLeft size={17} /> All projects
		</a>
		<p class="mt-3 text-xl leading-tight font-bold tracking-tight wrap-break-word">
			{data.project.name}
		</p>
		<div class="mt-2.5"><Badge option={projectStatus(data.project.status)} /></div>
	</div>

	<nav class="min-h-0 flex-1 overflow-y-auto p-3 pb-6" aria-label="Project sections">
		{#each groups as group, i (group.title)}
			<p class="nav-heading" style={i === 0 ? 'margin-top: 0.4rem' : ''}>{group.title}</p>
			<ul class="grid gap-1">
				{#each group.links as link (link.href)}
					<li>
						<a href={link.href} class="nav-item" aria-current={isCurrent(link) ? 'page' : undefined}>
							<link.icon size={20} class="shrink-0" />
							<span class="flex-1 truncate">{link.label}</span>
							{#if link.count}
								<span
									class="rounded-full px-2 py-0.5 text-[0.75rem] font-bold tabular-nums {link.alert
										? 'bg-bad text-bg'
										: 'bg-surface-3 text-fg'}"
								>
									{link.count > 99 ? '99+' : link.count}
								</span>
							{/if}
						</a>
					</li>
				{/each}
			</ul>
		{/each}
	</nav>
</aside>

<main class="flex min-w-0 flex-1 flex-col overflow-y-auto">
	<!-- Project sections (phones and tablets): one scrolling row -->
	<div class="sticky top-0 z-20 border-b border-line bg-bg lg:hidden">
		<p class="truncate px-4 pt-3 text-lg font-bold tracking-tight">{data.project.name}</p>
		<nav class="flex gap-2 overflow-x-auto px-4 py-3" aria-label="Project sections">
			{#each allLinks as link (link.href)}
				<a
					href={link.href}
					class="nav-item min-h-10! shrink-0 bg-surface-2"
					aria-current={isCurrent(link) ? 'page' : undefined}
				>
					<link.icon size={18} class="shrink-0" />
					{link.label}
				</a>
			{/each}
		</nav>
	</div>

	{#key path + (view ?? '')}
		<div class="mx-auto w-full max-w-[88rem] animate-rise px-5 py-8 sm:px-8 lg:px-11 lg:py-11">
			{@render children()}
		</div>
	{/key}
</main>

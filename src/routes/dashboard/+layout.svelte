<script lang="ts">
	import Bell from '@lucide/svelte/icons/bell';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Check from '@lucide/svelte/icons/check';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import CreditCard from '@lucide/svelte/icons/credit-card';
	import FolderKanban from '@lucide/svelte/icons/folder-kanban';
	import House from '@lucide/svelte/icons/house';
	import LogOut from '@lucide/svelte/icons/log-out';
	import MenuIcon from '@lucide/svelte/icons/menu';
	import Moon from '@lucide/svelte/icons/moon';
	import Plus from '@lucide/svelte/icons/plus';
	import Settings from '@lucide/svelte/icons/settings';
	import Sun from '@lucide/svelte/icons/sun';
	import UserRound from '@lucide/svelte/icons/user-round';
	import Users from '@lucide/svelte/icons/users';
	import X from '@lucide/svelte/icons/x';
	import { fade, fly } from 'svelte/transition';
	import { page } from '$app/state';
	import Avatar from '#lib/components/Avatar.svelte';
	import Menu from '#lib/components/Menu.svelte';
	import { projectStatus, role as roleOption } from '#lib/constants.ts';
	import { initials } from '#lib/format.ts';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const path = $derived(page.url.pathname);
	const projectId = $derived(page.params.projectId ?? null);
	/** Inside a project the workspace sidebar shrinks to icons and the project sidebar takes over. */
	const rail = $derived(Boolean(projectId));

	let drawer = $state(false);
	let theme = $state<'dark' | 'light'>('dark');
	$effect(() => {
		theme = data.theme;
	});
	$effect(() => {
		void path;
		drawer = false;
	});

	function toggleTheme() {
		theme = theme === 'dark' ? 'light' : 'dark';
		document.documentElement.dataset.theme = theme;
		document.cookie = `theme=${theme}; path=/; max-age=31536000; samesite=lax`;
	}

	const links = $derived([
		{ href: '/dashboard', label: 'Overview', icon: House, current: path === '/dashboard' },
		{
			href: '/dashboard/projects',
			label: 'Projects',
			icon: FolderKanban,
			current: path === '/dashboard/projects'
		},
		{
			href: '/dashboard/notifications',
			label: 'Notifications',
			icon: Bell,
			current: path.startsWith('/dashboard/notifications'),
			count: data.unread
		},
		{
			href: '/dashboard/members',
			label: 'People',
			icon: Users,
			current: path.startsWith('/dashboard/members')
		},
		{
			href: '/dashboard/billing',
			label: 'Premium',
			icon: CreditCard,
			current: path.startsWith('/dashboard/billing')
		},
		{
			href: '/docs',
			label: 'Docs',
			icon: BookOpen,
			current: path.startsWith('/docs')
		},
		{
			href: '/dashboard/settings',
			label: 'Workspace settings',
			icon: Settings,
			current: path.startsWith('/dashboard/settings')
		}
	]);

	const shownProjects = $derived(data.projects.filter((project) => project.status !== 'archived'));
	const dots: Record<string, string> = {
		ok: 'bg-ok',
		warn: 'bg-warn',
		bad: 'bg-bad',
		info: 'bg-info',
		neutral: 'bg-faint'
	};
</script>

{#snippet sidebar(compact: boolean)}
	<!-- Workspace switcher -->
	<Menu>
		{#snippet trigger({ open, toggle })}
			<button
				type="button"
				class="flex w-full items-center gap-3 rounded-block p-2 text-left transition-colors hover:bg-surface-2 {compact
					? 'justify-center'
					: ''}"
				aria-haspopup="true"
				aria-expanded={open}
				title={compact ? `${data.workspace.name} (switch workspace)` : undefined}
				onclick={toggle}
			>
				<span
					class="flex size-11 shrink-0 items-center justify-center rounded-block bg-accent text-[0.95rem] font-bold text-accent-fg"
					aria-hidden="true"
				>
					{initials(data.workspace.name)}
				</span>
				{#if !compact}
					<span class="min-w-0 flex-1">
						<span class="block truncate font-bold tracking-tight">{data.workspace.name}</span>
						<span class="block truncate text-[0.82rem] text-muted">
							{roleOption(data.workspace.role).label}
						</span>
					</span>
					<ChevronsUpDown size={18} class="shrink-0 text-faint" />
				{:else}
					<span class="sr-only">{data.workspace.name}: switch workspace</span>
				{/if}
			</button>
		{/snippet}

		<p class="eyebrow px-3 pt-2 pb-1.5">Your workspaces</p>
		{#each data.workspaces as workspace (workspace.id)}
			<form method="POST" action="/dashboard/switch">
				<input type="hidden" name="organization_id" value={workspace.id} />
				<button type="submit" class="menu-item" disabled={workspace.active}>
					<span
						class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-[0.78rem] font-bold"
						aria-hidden="true"
					>
						{initials(workspace.name)}
					</span>
					<span class="min-w-0 flex-1 truncate">{workspace.name}</span>
					{#if workspace.active}<Check size={18} class="shrink-0" aria-label="Current" />{/if}
				</button>
			</form>
		{/each}
		<div class="my-2 border-t border-line"></div>
		<a href="/dashboard/settings#new-workspace" class="menu-item">
			<Plus size={18} class="text-muted" /> New workspace
		</a>
	</Menu>

	<nav class="mt-5 flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto" aria-label="Workspace">
		<ul class="grid gap-1">
			{#each links as link (link.href)}
				<li>
					<a
						href={link.href}
						class="nav-item {compact ? 'justify-center px-0!' : ''}"
						aria-current={link.current ? 'page' : undefined}
						title={compact ? link.label : undefined}
					>
						<span class="relative shrink-0">
							<link.icon size={21} />
							{#if compact && link.count}
								<span class="absolute -top-1 -right-1 size-2.5 rounded-full bg-bad"></span>
							{/if}
						</span>
						{#if compact}
							<span class="sr-only">{link.label}</span>
						{:else}
							<span class="flex-1 truncate">{link.label}</span>
							{#if link.count}
								<span
									class="rounded-full bg-accent px-2 py-0.5 text-[0.75rem] font-bold text-accent-fg tabular-nums"
								>
									{link.count > 99 ? '99+' : link.count}
									<span class="sr-only">unread</span>
								</span>
							{/if}
						{/if}
					</a>
				</li>
			{/each}
		</ul>

		{#if compact}
			<div class="mx-auto my-4 h-px w-8 bg-line"></div>
		{:else}
			<p class="nav-heading">Projects</p>
		{/if}

		<ul class="grid gap-1">
			{#each shownProjects as project (project.id)}
				{@const current = projectId === project.id}
				<li>
					<a
						href="/dashboard/projects/{project.id}"
						class="nav-item {compact ? 'justify-center px-0!' : ''}"
						aria-current={current ? 'page' : undefined}
						title={compact ? project.name : undefined}
					>
						{#if compact}
							<span
								class="flex size-9 items-center justify-center rounded-[10px] text-[0.8rem] font-bold transition-colors {current
									? 'bg-accent text-accent-fg'
									: 'bg-surface-3 text-fg'}"
								aria-hidden="true"
							>
								{initials(project.name)}
							</span>
							<span class="sr-only">{project.name}</span>
						{:else}
							<span
								class="mx-1.5 size-2.5 shrink-0 rounded-full {dots[
									projectStatus(project.status).tone ?? 'neutral'
								]}"
								aria-hidden="true"
							></span>
							<span class="flex-1 truncate">{project.name}</span>
						{/if}
					</a>
				</li>
			{/each}
			{#if data.canEdit}
				<li>
					<a
						href="/dashboard/projects?new=1"
						class="nav-item {compact ? 'justify-center px-0!' : ''}"
						title={compact ? 'New project' : undefined}
					>
						<Plus size={21} class="shrink-0" />
						{#if compact}<span class="sr-only">New project</span>{:else}New project{/if}
					</a>
				</li>
			{/if}
		</ul>
	</nav>

	<!-- Account -->
	<div class="mt-3 border-t border-line pt-3">
		<Menu placement="above">
			{#snippet trigger({ open, toggle })}
				<button
					type="button"
					class="flex w-full items-center gap-3 rounded-block p-2 text-left transition-colors hover:bg-surface-2 {compact
						? 'justify-center'
						: ''}"
					aria-haspopup="true"
					aria-expanded={open}
					title={compact ? 'Your account' : undefined}
					onclick={toggle}
				>
					<Avatar name={data.me.name} src={data.me.avatarUrl} size={44} />
					{#if !compact}
						<span class="min-w-0 flex-1">
							<span class="block truncate font-semibold">{data.me.name}</span>
							<span class="block truncate text-[0.82rem] text-muted">
								{data.me.username ? `@${data.me.username}` : data.me.email}
							</span>
						</span>
						<ChevronsUpDown size={18} class="shrink-0 text-faint" />
					{:else}
						<span class="sr-only">Your account</span>
					{/if}
				</button>
			{/snippet}

			<a href="/dashboard/account" class="menu-item">
				<UserRound size={18} class="text-muted" /> Your account
			</a>
			<button type="button" class="menu-item" onclick={toggleTheme}>
				{#if theme === 'dark'}
					<Sun size={18} class="text-muted" /> Switch to light theme
				{:else}
					<Moon size={18} class="text-muted" /> Switch to dark theme
				{/if}
			</button>
			<div class="my-2 border-t border-line"></div>
			<form method="POST" action="/auth/logout">
				<button type="submit" class="menu-item">
					<LogOut size={18} class="text-muted" /> Log out
				</button>
			</form>
		</Menu>
	</div>
{/snippet}

<a
	href="#main"
	class="btn btn-primary sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
>
	Skip to content
</a>

<div class="flex h-dvh overflow-hidden bg-surface">
	<!-- Workspace sidebar (desktop) -->
	<aside
		class="hidden shrink-0 flex-col p-3 transition-[width] duration-300 ease-(--ease) lg:flex {rail
			? 'w-[5.5rem]'
			: 'w-[18.5rem]'}"
	>
		{@render sidebar(rail)}
	</aside>

	<div class="flex min-w-0 flex-1 flex-col lg:py-3 lg:pr-3">
		<!-- Top bar (phones and tablets) -->
		<header class="flex items-center gap-3 border-b border-line px-4 py-3 lg:hidden">
			<button
				type="button"
				class="btn btn-icon"
				aria-label="Open menu"
				aria-expanded={drawer}
				onclick={() => (drawer = true)}
			>
				<MenuIcon size={22} />
			</button>
			<a href="/dashboard" class="flex min-w-0 flex-1 items-center gap-2.5 no-underline">
				<img src="/logo-64.png" alt="" width="36" height="36" class="size-9 rounded-[10px]" />
				<span class="truncate text-lg font-bold tracking-tight">{data.workspace.name}</span>
			</a>
			<a href="/dashboard/notifications" class="btn btn-icon relative" aria-label="Notifications">
				<Bell size={21} />
				{#if data.unread}
					<span class="absolute top-2.5 right-2.5 size-2.5 rounded-full bg-bad"></span>
				{/if}
			</a>
		</header>

		<!-- The "window": everything the person is working on -->
		<div
			id="main"
			class="flex min-h-0 flex-1 overflow-hidden border-line bg-bg lg:rounded-block-xl lg:border"
		>
			{#if rail}
				{@render children()}
			{:else}
				<main class="min-w-0 flex-1 overflow-y-auto">
					{#key path}
						<div class="mx-auto w-full max-w-6xl animate-rise px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
							{@render children()}
						</div>
					{/key}
				</main>
			{/if}
		</div>
	</div>
</div>

<!-- Menu drawer (phones and tablets) -->
{#if drawer}
	<div class="fixed inset-0 z-40 lg:hidden">
		<button
			type="button"
			class="absolute inset-0 bg-black/70"
			aria-label="Close menu"
			transition:fade={{ duration: 180 }}
			onclick={() => (drawer = false)}
		></button>
		<aside
			class="absolute inset-y-0 left-0 flex w-[min(20rem,calc(100vw-3rem))] flex-col rounded-r-block-xl border-r border-line bg-surface p-3"
			transition:fly={{ x: -320, duration: 260 }}
		>
			<button
				type="button"
				class="btn btn-icon btn-sm absolute top-3 -right-12 rounded-full"
				aria-label="Close menu"
				onclick={() => (drawer = false)}
			>
				<X size={18} />
			</button>
			{@render sidebar(false)}
		</aside>
	</div>
{/if}

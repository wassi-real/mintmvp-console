<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { API_RESOURCES, SLICE_FIELDS, type ApiField } from '#lib/api-reference.ts';

	const origin = $derived(page.url.origin);
	let copied = $state('');
	let active = $state('authentication');
	let sectionNav: HTMLElement | undefined = $state();

	function curl(method: string, path: string, body?: unknown): string {
		const lines = [`curl -X ${method} ${origin}${path}`, `  -H "Authorization: Bearer mint_your_key"`];
		if (body) {
			lines.push(`  -H "Content-Type: application/json"`);
			lines.push(`  -d '${JSON.stringify(body)}'`);
		}
		return lines.join(' \\\n');
	}

	async function copy(id: string, text: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = id;
		} catch {
			copied = '';
		}
	}

	function fieldLine(field: ApiField): string {
		const bits: string[] = [field.kind];
		if (field.required) bits.push('required on create');
		if (field.nullable) bits.push('nullable');
		if (field.max) bits.push(`max ${field.max}`);
		if (field.options?.length) {
			const shown = field.options.filter(Boolean);
			bits.push(shown.join(' | '));
		}
		return bits.join(' · ');
	}

	const nav = [
		{ href: '#authentication', label: 'Authentication' },
		{ href: '#calls', label: 'Calling the API' },
		{ href: '#errors', label: 'Errors' },
		...API_RESOURCES.map((resource) => ({ href: `#${resource.slug}`, label: resource.title })),
		{ href: '#task-comments', label: 'Task comments' },
		{ href: '#milestone-steps', label: 'Milestone steps' },
		{ href: '#ai', label: 'MintAI' }
	];
	const sectionIds = nav.map((item) => item.href.slice(1));

	function sectionInView() {
		const line = 110;
		let current = sectionIds[0];
		for (const id of sectionIds) {
			const section = document.getElementById(id);
			if (section && section.getBoundingClientRect().top <= line) current = id;
		}
		const atBottom =
			window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 40;
		if (atBottom) current = sectionIds[sectionIds.length - 1];
		if (current !== active) active = current;
	}

	function keepActiveVisible(id: string) {
		const link = sectionNav?.querySelector<HTMLAnchorElement>(`a[href="#${id}"]`);
		if (!link || !sectionNav) return;
		const navBox = sectionNav.getBoundingClientRect();
		const linkBox = link.getBoundingClientRect();
		const pad = 8;
		if (linkBox.top < navBox.top + pad) sectionNav.scrollTop -= navBox.top + pad - linkBox.top;
		else if (linkBox.bottom > navBox.bottom - pad) {
			sectionNav.scrollTop += linkBox.bottom - (navBox.bottom - pad);
		}
		if (linkBox.left < navBox.left + pad) sectionNav.scrollLeft -= navBox.left + pad - linkBox.left;
		else if (linkBox.right > navBox.right - pad) {
			sectionNav.scrollLeft += linkBox.right - (navBox.right - pad);
		}
	}

	$effect(() => {
		keepActiveVisible(active);
	});

	onMount(() => {
		const hash = location.hash.replace('#', '');
		if (sectionIds.includes(hash)) active = hash;
		let frame = 0;
		const onScroll = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(sectionInView);
		};
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onScroll);
		return () => {
			cancelAnimationFrame(frame);
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onScroll);
		};
	});
</script>

<svelte:head>
	<title>API docs · Console</title>
	<meta
		name="description"
		content="Project API keys for MintMVP Console. Read and change one project, including MintAI, from your own tools."
	/>
</svelte:head>

<div class="docs">
	<header class="bar">
		<div class="bar-inner">
			<a href="/" class="brand">
				<img src="/logo-64.png" alt="" width="32" height="32" />
				<span>Console</span>
			</a>
			<nav aria-label="Site">
				<a href="/docs" aria-current="page">Docs</a>
				<a href="/dashboard" class="btn btn-primary btn-sm">Open app</a>
			</nav>
		</div>
	</header>

	<div class="frame">
		<aside>
			<p>On this page</p>
			<nav aria-label="Documentation" bind:this={sectionNav}>
				{#each nav as item (item.href)}
					<a
						href={item.href}
						aria-current={active === item.href.slice(1) ? 'true' : undefined}
						onclick={() => (active = item.href.slice(1))}
					>
						{item.label}
					</a>
				{/each}
			</nav>
		</aside>

		<article>
			<p class="eyebrow">Project API</p>
			<h1>Use a project from your own code.</h1>
			<p class="lead">
				Each API key belongs to one project. It can read and change that project’s tasks, reports,
				finance, monitoring and the rest of the project, and it can talk to MintAI. It cannot see other
				projects, other workspaces, API keys, or GitHub tokens.
			</p>

			<section id="authentication">
				<h2>Authentication</h2>
				<p>
					Create a key in the project under <strong>API keys</strong>. The full key is shown once. Send
					it on every request.
				</p>
				{@render sample('auth', curl('GET', '/api/v1'), 'Who am I')}
				<p>You can also send the key as <code>X-Api-Key: mint_…</code>.</p>
			</section>

			<section id="calls">
				<h2>Calling the API</h2>
				<p>
					The base path is <code>{origin}/api/v1</code>. Responses are JSON. Lists accept
					<code>limit</code> (1–100, default 50) and <code>offset</code>. Some lists accept a filter such
					as <code>?status=open</code>.
				</p>
				<p>A list looks like this:</p>
				<pre><code>{`{
  "data": [],
  "count": 0,
  "limit": 50,
  "offset": 0
}`}</code></pre>
				<p>One record, and a create, look like <code>{"{ \"data\": { … } }"}</code>. Create returns HTTP 201.</p>
				<p>
					Free workspaces have the same monthly caps as the app: 30 tasks, 3 milestones, 5 reports, 3
					specs and 5 incidents per project. Premium ($5 a month) removes the task, milestone and incident
					caps. Reports stay at 40 a month and specs at 20. Those caps belong to the workspace owner.
				</p>
			</section>

			<section id="errors">
				<h2>Errors</h2>
				<p>Failures are <code>{"{ \"error\": \"…\" }"}</code> with an HTTP status.</p>
				<ul>
					<li><strong>401</strong> — missing, unknown or revoked key</li>
					<li><strong>400</strong> — the body or a field is wrong</li>
					<li><strong>402</strong> — monthly cap, or MintAI without Premium</li>
					<li><strong>404</strong> — that record is not in this project</li>
					<li><strong>405</strong> — that method is not allowed</li>
				</ul>
			</section>

			{#each API_RESOURCES as resource (resource.slug)}
				<section id={resource.slug}>
					<h2>{resource.title}</h2>
					<p>{resource.summary}</p>
					<p class="path"><code>/api/v1/{resource.slug}</code></p>
					<p class="methods">
						{#each resource.methods as method (method)}
							<span>{method}</span>
						{/each}
						{#if resource.slug !== 'project' && resource.methods.some((method) => method === 'GET' || method === 'PATCH' || method === 'DELETE')}
							<span>by id</span>
						{/if}
					</p>
					{#if resource.slug !== 'project' && resource.methods.includes('GET')}
						<p>
							Fetch one record at <code>/api/v1/{resource.slug}/{'{id}'}</code>.
							{#if resource.methods.includes('PATCH')} Change it with <code>PATCH</code> and remove it with <code>DELETE</code>.{/if}
						</p>
					{/if}
					{#if resource.monthly}
						<p>
							Monthly cap: {resource.monthly.free} on Free{#if resource.monthly.premium === 0}, unlimited on Premium{:else}, {resource.monthly.premium} on Premium{/if}.
						</p>
					{/if}
					{#if resource.listOmits?.length}
						<p>List responses leave out {resource.listOmits.join(', ')}.</p>
					{/if}
					{#if resource.filters?.length}
						<p>Filter a list with {resource.filters.map((name) => `?${name}=`).join(', ')}.</p>
					{/if}
					{#if resource.fields.length}
						{@render fields(resource.fields)}
					{/if}
					{@render sample(
						resource.slug,
						resource.example
							? curl(resource.methods.includes('POST') ? 'POST' : 'PATCH', `/api/v1/${resource.slug}`, resource.example)
							: curl('GET', `/api/v1/${resource.slug}`),
						resource.example ? 'Example' : 'List'
					)}
				</section>
			{/each}

			<section id="task-comments">
				<h2>Task comments</h2>
				<p>Comments stay on a task in this project.</p>
				<ul>
					<li><code>GET /api/v1/tasks/{'{id}'}/comments</code></li>
					<li><code>POST /api/v1/tasks/{'{id}'}/comments</code> with <code>{"{ \"body\": \"…\" }"}</code></li>
					<li><code>DELETE /api/v1/tasks/{'{id}'}/comments/{'{commentId}'}</code></li>
				</ul>
				{@render sample('comments', curl('POST', '/api/v1/tasks/TASK_ID/comments', { body: 'Checked on staging.' }), 'Add a comment')}
			</section>

			<section id="milestone-steps">
				<h2>Milestone steps</h2>
				<p>Steps belong to one milestone. The milestone has to be in this project.</p>
				<ul>
					<li><code>GET /api/v1/milestones/{'{id}'}/slices</code></li>
					<li><code>POST /api/v1/milestones/{'{id}'}/slices</code></li>
					<li><code>PATCH /api/v1/milestones/{'{id}'}/slices/{'{sliceId}'}</code></li>
					<li><code>DELETE /api/v1/milestones/{'{id}'}/slices/{'{sliceId}'}</code></li>
				</ul>
				{@render fields(SLICE_FIELDS)}
				{@render sample(
					'slices',
					curl('POST', '/api/v1/milestones/MILESTONE_ID/slices', { title: 'Write the spec', status: 'pending' }),
					'Add a step'
				)}
			</section>

			<section id="ai">
				<h2>MintAI</h2>
				<p>
					<code>POST /api/v1/ai</code> sends one message. MintAI can read and change this same project:
					tasks, specs, milestones, reports and comments. Chats are saved on the workspace owner’s MintAI
					history for the project, and each message uses one of that owner’s 100 Premium requests for the
					month.
				</p>
				{@render sample(
					'ai-get',
					curl('GET', '/api/v1/ai'),
					'Allowance and chats'
				)}
				{@render sample(
					'ai-post',
					curl('POST', '/api/v1/ai', { message: 'List the open tasks and add one for the status page.' }),
					'Ask MintAI'
				)}
				<p>
					Send <code>chatId</code> from a previous reply to continue that chat. Send
					<code>newChat: true</code> to start another one. <code>GET /api/v1/ai?chat=CHAT_ID</code> returns
					that conversation.
				</p>
				<pre><code>{`{
  "chatId": "…",
  "reply": "…",
  "remaining": 99
}`}</code></pre>
			</section>
		</article>
	</div>
</div>

{#snippet fields(list: readonly ApiField[])}
	<div class="table-wrap">
		<table>
			<thead>
				<tr>
					<th>Field</th>
					<th>Rules</th>
				</tr>
			</thead>
			<tbody>
				{#each list as field (field.name)}
					<tr>
						<td><code>{field.name}</code></td>
						<td>{fieldLine(field)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/snippet}

{#snippet sample(id: string, text: string, label: string)}
	<div class="sample">
		<div>
			<span>{label}</span>
			<button type="button" class="btn btn-sm" onclick={() => copy(id, text)}>
				{copied === id ? 'Copied' : 'Copy'}
			</button>
		</div>
		<pre><code>{text}</code></pre>
	</div>
{/snippet}

<style>
	.docs {
		min-height: 100dvh;
		background: var(--bg);
		color: var(--fg);
	}
	.bar {
		position: sticky;
		top: 0;
		z-index: 20;
		border-bottom: 1px solid var(--line);
		background: color-mix(in srgb, var(--bg) 88%, transparent);
		backdrop-filter: blur(16px);
	}
	.bar-inner,
	.frame {
		width: min(72rem, calc(100% - 2rem));
		margin-inline: auto;
	}
	.bar-inner {
		display: flex;
		align-items: center;
		min-height: 4.25rem;
		gap: 1rem;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		text-decoration: none;
		color: inherit;
	}
	.brand img {
		width: 2rem;
		height: 2rem;
		border-radius: 9px;
	}
	.bar nav {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-left: auto;
	}
	.bar nav a:not(.btn) {
		color: var(--fg);
		font-weight: 700;
		text-decoration: none;
	}
	.frame {
		display: grid;
		gap: 2rem;
		padding: 2.5rem 0 5rem;
	}
	aside p {
		margin-bottom: 0.6rem;
		color: var(--fg-muted);
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	aside nav {
		display: flex;
		gap: 0.4rem;
		overflow-x: auto;
		padding-bottom: 0.4rem;
	}
	aside a {
		flex: none;
		padding: 0.35rem 0.7rem;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--fg-muted);
		font-size: 0.92rem;
		font-weight: 600;
		text-decoration: none;
	}
	aside a[aria-current='true'] {
		background: var(--accent);
		color: var(--accent-fg);
	}
	article h1 {
		margin-top: 0.6rem;
		font-size: clamp(2.4rem, 5vw, 4rem);
		line-height: 1.02;
		letter-spacing: -0.04em;
	}
	.lead {
		max-width: 40rem;
		margin-top: 1rem;
		color: var(--fg-muted);
		font-size: 1.15rem;
	}
	section {
		margin-top: 3.2rem;
		scroll-margin-top: 5.5rem;
	}
	section h2 {
		font-size: 1.7rem;
		letter-spacing: -0.03em;
	}
	section p,
	section li {
		margin-top: 0.75rem;
		color: var(--fg-muted);
		font-size: 1.05rem;
	}
	section ul {
		margin-top: 0.8rem;
		padding-left: 1.2rem;
	}
	section strong {
		color: var(--fg);
	}
	code {
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 0.92em;
	}
	p code,
	li code {
		padding: 0.1rem 0.35rem;
		border-radius: 0.4rem;
		background: var(--surface-2);
		color: var(--fg);
	}
	.path {
		font-size: 1rem;
	}
	.methods {
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
	}
	.methods span {
		padding: 0.15rem 0.5rem;
		border-radius: 999px;
		background: var(--surface-3);
		color: var(--fg);
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.04em;
	}
	pre {
		margin-top: 0.8rem;
		overflow-x: auto;
		padding: 1rem 1.1rem;
		border-radius: 1rem;
		background: var(--surface-2);
		color: var(--fg);
		font-size: 0.92rem;
		line-height: 1.5;
	}
	.sample {
		margin-top: 1rem;
	}
	.sample div {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.sample span {
		color: var(--fg-muted);
		font-size: 0.85rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.table-wrap {
		margin-top: 1rem;
		overflow-x: auto;
		border: 1px solid var(--line);
		border-radius: 1rem;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.95rem;
	}
	th,
	td {
		padding: 0.7rem 0.9rem;
		text-align: left;
		vertical-align: top;
		border-bottom: 1px solid var(--line);
	}
	th {
		color: var(--fg-muted);
		font-size: 0.78rem;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	td:last-child {
		color: var(--fg-muted);
	}
	tr:last-child td {
		border-bottom: 0;
	}

	@media (min-width: 980px) {
		.frame {
			grid-template-columns: 14rem 1fr;
			align-items: start;
			gap: 3rem;
		}
		aside {
			position: sticky;
			top: 5.5rem;
		}
		aside nav {
			display: grid;
			max-height: calc(100dvh - 8rem);
			overflow: auto;
			padding-bottom: 0;
		}
		aside a {
			background: transparent;
			border-left: 2px solid transparent;
			border-radius: 0 0.6rem 0.6rem 0;
			padding-left: 0.75rem;
		}
		aside a:hover {
			background: var(--surface-2);
			color: var(--fg);
		}
		aside a[aria-current='true'] {
			background: color-mix(in srgb, var(--accent) 16%, transparent);
			border-left-color: var(--accent);
			color: var(--fg);
		}
	}
</style>

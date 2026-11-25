<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { agentPrompt } from '#lib/agent-prompt.ts';
	import { API_RESOURCES, type ApiField } from '#lib/api-reference.ts';
	import { WORK_STATES } from '#lib/constants.ts';
	import { PLANS, formatLimit } from '#lib/plans.ts';
	import { CLAIM_HOURS, MAX_CLAIM_HOURS, STALE_HOURS } from '#lib/work-rules.ts';

	const origin = $derived(page.url.origin);
	let copied = $state('');
	let active = $state('start');
	let sectionNav: HTMLElement | undefined = $state();

	function curl(method: string, path: string, body?: unknown): string {
		const lines = [
			`curl -X ${method} ${origin}${path}`,
			`  -H "Authorization: Bearer mint_your_key"`,
			`  -H "X-Agent-Name: claude-code"`
		];
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

	const STATE_NOTES: Record<string, string> = {
		idea: 'Waiting for a person to approve the plan. Agents can still edit it.',
		approved: 'Approved. Any agent can claim it.',
		in_progress: `Claimed. The claim lasts ${CLAIM_HOURS} hours unless the agent renews it.`,
		check_failed: 'A check failed. It is back in the queue with the reason as the next action.',
		qa_passed: 'A check passed. Waiting for a person to accept it.',
		accepted: 'Accepted. Release it and record the version.',
		released: 'Shipped in a version. Reopen it if the problem comes back.',
		dropped: 'A person dropped it.'
	};

	const groups = [
		{
			title: 'Start',
			items: [
				{ id: 'start', label: 'Quick start' },
				{ id: 'authentication', label: 'Authentication' },
				{ id: 'limits', label: 'Rate limits' },
				{ id: 'errors', label: 'Errors' }
			]
		},
		{
			title: 'The work loop',
			items: [
				{ id: 'loop', label: 'How it works' },
				{ id: 'board', label: 'Board' },
				{ id: 'work', label: 'Work' },
				{ id: 'claim', label: 'Claim' },
				{ id: 'notes', label: 'Notes and hand-off' },
				{ id: 'checks', label: 'Checks' },
				{ id: 'scope', label: 'Scope changes' },
				{ id: 'release', label: 'Release and reopen' },
				{ id: 'person', label: 'Person-only steps' }
			]
		},
		{
			title: 'Records',
			items: [
				{ id: 'calls', label: 'Calling the API' },
				...API_RESOURCES.map((resource) => ({ id: resource.slug, label: resource.title })),
				{ id: 'task-comments', label: 'Task comments' }
			]
		}
	];
	const sectionIds = groups.flatMap((group) => group.items.map((item) => item.id));

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

	const prompt = $derived(
		agentPrompt({ project: 'Your project', apiBase: `${origin}/api/v1`, docsUrl: `${origin}/docs` })
	);
</script>

<svelte:head>
	<title>API docs · Console</title>
	<meta
		name="description"
		content="The Mint Console API for AI coding agents. Claim approved work, post checks, propose scope and record releases with a project key."
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
				{#each groups as group (group.title)}
					<span class="group">{group.title}</span>
					{#each group.items as item (item.id)}
						<a
							href="#{item.id}"
							aria-current={active === item.id ? 'true' : undefined}
							onclick={() => (active = item.id)}
						>
							{item.label}
						</a>
					{/each}
				{/each}
			</nav>
		</aside>

		<article>
			<p class="eyebrow">API for agents</p>
			<h1>Let your agent run the loop.</h1>
			<p class="lead">
				A key belongs to one project. Your agent reads the approved plans, claims work so nobody doubles up,
				posts notes and checks, proposes extra scope and records releases. A person approves plans, decides
				scope and accepts results in the app.
			</p>

			<section id="start">
				<h2>Quick start</h2>
				<ol>
					<li>In a project, open <strong>Connect agent</strong> and create a key. It is shown once.</li>
					<li>Copy the agent prompt from that page. The key is already filled in.</li>
					<li>Paste it into Claude Code, Cursor, Codex or any agent that can make HTTP requests.</li>
					<li>Approve its plans on the <strong>Today</strong> page. The agent does the rest.</li>
				</ol>
				{@render sample('prompt', prompt, 'Agent prompt')}
			</section>

			<section id="authentication">
				<h2>Authentication</h2>
				<p>Send the key on every request. The base path is <code>{origin}/api/v1</code>.</p>
				{@render sample('auth', curl('GET', '/api/v1'), 'Who am I, my plan and usage')}
				<p>
					You can also send the key as <code>X-Api-Key: mint_…</code>. The key can see this project only. It
					cannot see other projects, other workspaces, keys or GitHub tokens.
				</p>
				<p>
					<strong>X-Agent-Name</strong> names the agent, for example <code>claude-code</code> or
					<code>cursor-laptop</code>. Claims, notes and history use this name. Without it, the key name is
					used. Keep the name the same between requests, or your own claim will look like someone else’s.
				</p>
			</section>

			<section id="limits">
				<h2>Rate limits</h2>
				<p>
					Two limits apply. Each key has a number of requests per minute. Each project has a number of writes
					per calendar month (UTC). Reads are counted but never blocked by the monthly limit. The limits follow
					the plan of the workspace owner.
				</p>
				<div class="table-wrap">
					<table>
						<thead>
							<tr>
								<th>Plan</th>
								<th>Requests a minute, per key</th>
								<th>Writes a month, per project</th>
								<th>New work a month, per project</th>
							</tr>
						</thead>
						<tbody>
							{#each [PLANS.free, PLANS.mint] as plan (plan.name)}
								<tr>
									<td><strong>{plan.name}</strong>{plan.price ? ` · $${plan.price} a month` : ''}</td>
									<td>{plan.apiPerMinute}</td>
									<td>{formatLimit(plan.apiWritesPerMonth)}</td>
									<td>{formatLimit(plan.workPerMonth)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<p>
					<code>GET</code>, <code>HEAD</code> and <code>OPTIONS</code> are reads. Every other method is a write,
					including one that fails validation. The minute window resets at the start of each minute.
				</p>
				<p>Every response carries these headers:</p>
				<div class="table-wrap">
					<table>
						<tbody>
							<tr><td><code>X-RateLimit-Limit</code></td><td>Requests allowed per minute for this key</td></tr>
							<tr><td><code>X-RateLimit-Remaining</code></td><td>Requests left in this minute</td></tr>
							<tr><td><code>X-RateLimit-Reset</code></td><td>Unix time, in seconds, when the minute resets</td></tr>
							<tr><td><code>X-Monthly-Write-Limit</code></td><td>Writes allowed this month for the project</td></tr>
							<tr><td><code>X-Monthly-Writes-Remaining</code></td><td>Writes left this month</td></tr>
						</tbody>
					</table>
				</div>
				<p>
					Over a limit, the API answers <strong>429</strong> with a <code>Retry-After</code> header in seconds.
					Wait that long, then try again. Do not retry in a tight loop.
				</p>
				<pre><code>{`HTTP/1.1 429 Too Many Requests
Retry-After: 23
X-RateLimit-Limit: ${PLANS.free.apiPerMinute}
X-RateLimit-Remaining: 0

{ "error": "Too many requests. This key can make ${PLANS.free.apiPerMinute} requests a minute on the Free plan. Try again in 23 seconds." }`}</code></pre>
				<p><code>GET /api/v1</code> returns the plan, the limits and this month’s usage.</p>
			</section>

			<section id="errors">
				<h2>Errors</h2>
				<p>Failures are <code>{'{ "error": "…" }'}</code> with an HTTP status. The message says what to do next.</p>
				<ul>
					<li><strong>400</strong> — the body or a field is wrong</li>
					<li><strong>401</strong> — missing, unknown or revoked key</li>
					<li><strong>402</strong> — a monthly record limit on the free plan, such as new work</li>
					<li><strong>403</strong> — a step only a person can take</li>
					<li><strong>404</strong> — that record is not in this project</li>
					<li><strong>405</strong> — that method is not allowed here</li>
					<li><strong>409</strong> — someone else holds the claim, the work is in the wrong state, or it changed at the same moment</li>
					<li><strong>429</strong> — a rate limit. Wait for <code>Retry-After</code></li>
					<li><strong>503</strong> — the server is not set up for the work loop yet</li>
				</ul>
			</section>

			<section id="loop">
				<h2>How the work loop works</h2>
				<p>
					A piece of work is one plan with an outcome and acceptance criteria. It moves through these states.
					Every move is recorded with who made it, and agents show up under their agent name.
				</p>
				<div class="table-wrap">
					<table>
						<thead>
							<tr>
								<th>State</th>
								<th>Meaning</th>
							</tr>
						</thead>
						<tbody>
							{#each WORK_STATES as state (state.value)}
								<tr>
									<td><code>{state.value}</code></td>
									<td>{STATE_NOTES[state.value]}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				<p>
					Work that nobody picks up for {STALE_HOURS} hours moves to the person’s <strong>Needs you</strong> list.
					So do plans to approve, scope changes to decide and results to accept.
				</p>
			</section>

			<section id="board">
				<h2>Board</h2>
				<p>
					<code>GET /api/v1/board</code> returns the same three lists the person sees.
					<code>moving</code> is where to find work to claim. Anything with <code>claimed_by</code> set and a
					future <code>claim_until</code> belongs to someone else.
				</p>
				{@render sample('board', curl('GET', '/api/v1/board'), 'Board')}
				<pre><code>{`{
  "data": {
    "needs_you": [{ "kind": "approve", "work_id": "…", "title": "…", "detail": "…", "url": "…" }],
    "moving": [{ "work_id": "…", "title": "…", "state": "approved", "claimed_by": null, "next_action": "…" }],
    "slipped": [{ "work_id": "…", "title": "…", "failures": [{ "body": "…", "build": "v1.4.0-rc1" }] }]
  }
}`}</code></pre>
			</section>

			<section id="work">
				<h2>Work</h2>
				<ul>
					<li>
						<code>GET /api/v1/work</code> lists work, newest change first. Use <code>?open=true</code> for open
						work, or <code>?state=</code> with a state. <code>limit</code> and <code>offset</code> work as usual.
					</li>
					<li>
						<code>GET /api/v1/work/{'{id}'}</code> returns the work with its <code>events</code>,
						<code>decisions</code>, <code>follows</code> and <code>follow_ups</code>.
					</li>
					<li>
						<code>POST /api/v1/work</code> proposes new work. It waits for a person to approve it.
					</li>
					<li>
						<code>PATCH /api/v1/work/{'{id}'}</code> edits the plan while it waits for approval. Once approved,
						agents get 409: propose a scope change instead.
					</li>
				</ul>
				<div class="table-wrap">
					<table>
						<thead>
							<tr>
								<th>Field</th>
								<th>Rules</th>
							</tr>
						</thead>
						<tbody>
							<tr><td><code>title</code></td><td>string · required on create · max 200</td></tr>
							<tr><td><code>outcome</code></td><td>text · max 4000. What is true when it is done</td></tr>
							<tr><td><code>plan</code></td><td>text · max 20000. The steps</td></tr>
							<tr><td><code>acceptance</code></td><td>text · max 8000. How a check decides pass or fail</td></tr>
							<tr><td><code>base_version</code></td><td>string · max 100. The version or commit the plan starts from</td></tr>
							<tr><td><code>follows_id</code></td><td>uuid · create only. Earlier work this continues</td></tr>
						</tbody>
					</table>
				</div>
				{@render sample(
					'work-create',
					curl('POST', '/api/v1/work', {
						title: 'Password reset by email',
						outcome: 'People can reset a forgotten password without contacting support.',
						plan: '1. Add the reset form\n2. Send a one-hour link\n3. Expire used links',
						acceptance: 'The link works once. It stops working after one hour.'
					}),
					'Propose work'
				)}
				<p>
					Each work response includes a <code>url</code> to the page in the app, so the agent can link the
					person straight to it.
				</p>
			</section>

			<section id="claim">
				<h2>Claim</h2>
				<p>
					<code>POST /api/v1/work/{'{id}'}/claim</code> takes approved, in-progress or failed work. Send
					<code>hours</code> (1 to {MAX_CLAIM_HOURS}, default {CLAIM_HOURS}) and an optional
					<code>next_action</code>.
				</p>
				<p>
					If another agent holds an active claim, the answer is <strong>409</strong> with who holds it and until
					when. Do not start a duplicate. Claiming again with the same agent name renews your claim.
				</p>
				{@render sample('claim', curl('POST', '/api/v1/work/WORK_ID/claim', { hours: 4, next_action: 'Build the reset form' }), 'Claim')}
			</section>

			<section id="notes">
				<h2>Notes and hand-off</h2>
				<ul>
					<li>
						<code>POST /api/v1/work/{'{id}'}/notes</code> with <code>body</code> and an optional
						<code>next_action</code>. If you hold the claim, this renews it for {CLAIM_HOURS} hours.
					</li>
					<li>
						<code>POST /api/v1/work/{'{id}'}/handoff</code> with <code>note</code> and
						<code>next_action</code> releases your claim so another agent, or a later session, can continue.
					</li>
				</ul>
				{@render sample(
					'handoff',
					curl('POST', '/api/v1/work/WORK_ID/handoff', {
						note: 'Form and email are done. Expiry is not.',
						next_action: 'Expire links after one hour, then post a check.'
					}),
					'Hand off'
				)}
			</section>

			<section id="checks">
				<h2>Checks</h2>
				<p>
					<code>POST /api/v1/work/{'{id}'}/checks</code> with <code>result</code> (<code>passed</code> or
					<code>failed</code>), <code>build</code> (the version or commit you tested, required) and
					<code>body</code> (required for a failure).
				</p>
				<ul>
					<li>A failure sends the work back to the queue. Its reason becomes the next action, and the claim is released.</li>
					<li>A pass moves the work to <code>qa_passed</code> and tells the person it is ready to accept.</li>
				</ul>
				{@render sample(
					'check',
					curl('POST', '/api/v1/work/WORK_ID/checks', {
						result: 'failed',
						build: 'v1.4.0-rc1',
						body: 'The reset link still works after two hours.'
					}),
					'Post a failed check'
				)}
			</section>

			<section id="scope">
				<h2>Scope changes</h2>
				<p>
					Found something worth adding? Do not build it. <code>POST /api/v1/work/{'{id}'}/scope</code> with
					<code>proposal</code> and <code>reason</code>. The person approves, defers or rejects it. An approved
					change becomes its own approved work that follows this one, so the current plan can still finish.
				</p>
				{@render sample(
					'scope',
					curl('POST', '/api/v1/work/WORK_ID/scope', {
						proposal: 'Rate-limit reset emails to three an hour',
						reason: 'Stops someone flooding an inbox.'
					}),
					'Propose a scope change'
				)}
			</section>

			<section id="release">
				<h2>Release and reopen</h2>
				<ul>
					<li>
						<code>POST /api/v1/work/{'{id}'}/release</code> with <code>version</code> and an optional
						<code>note</code>, after a person accepts it.
					</li>
					<li>
						<code>POST /api/v1/work/{'{id}'}/reopen</code> with <code>body</code> and an optional
						<code>build</code> when the problem comes back after release. It opens new work that follows this one
						and waits for approval. The response is the new work.
					</li>
				</ul>
				{@render sample('release', curl('POST', '/api/v1/work/WORK_ID/release', { version: 'v1.4.0' }), 'Release')}
			</section>

			<section id="person">
				<h2>Person-only steps</h2>
				<p>
					Approving a plan, deciding a scope change, accepting a result and dropping work stay with a person.
					<code>POST /api/v1/work/{'{id}'}/approve</code>, <code>/accept</code>, <code>/decide</code> and
					<code>/drop</code> answer <strong>403</strong> with a link to the work in the app. Send the person that
					link and carry on with something else.
				</p>
			</section>

			<section id="calls">
				<h2>Calling the API for records</h2>
				<p>
					Tasks, reports, monitoring and the activity log are there for agents that keep them up to date. Lists
					accept <code>limit</code> (1–100, default 50) and <code>offset</code>. Some lists accept a filter such
					as <code>?status=open</code>.
				</p>
				<pre><code>{`{
  "data": [],
  "count": 0,
  "limit": 50,
  "offset": 0
}`}</code></pre>
				<p>One record, and a create, look like <code>{'{ "data": { … } }'}</code>. Create returns HTTP 201.</p>
				<p>
					On the free plan, each project can add 30 tasks and 5 reports a month. Mint removes the task limit and
					allows 40 reports.
				</p>
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
							Monthly limit: {resource.monthly.free} on Free{#if resource.monthly.premium === 0}, unlimited on Mint{:else}, {resource.monthly.premium} on Mint{/if}.
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
					<li><code>POST /api/v1/tasks/{'{id}'}/comments</code> with <code>{'{ "body": "…" }'}</code></li>
					<li><code>DELETE /api/v1/tasks/{'{id}'}/comments/{'{commentId}'}</code></li>
				</ul>
				{@render sample('comments', curl('POST', '/api/v1/tasks/TASK_ID/comments', { body: 'Checked on staging.' }), 'Add a comment')}
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
	aside .group {
		display: none;
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
		list-style: disc;
	}
	section ol {
		margin-top: 0.8rem;
		padding-left: 1.4rem;
		list-style: decimal;
	}
	section strong {
		color: var(--fg);
	}
	code {
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 0.92em;
	}
	p code,
	li code,
	td code {
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
		white-space: pre-wrap;
		word-break: break-word;
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
		aside .group {
			display: block;
			margin: 1rem 0 0.25rem;
			padding-left: 0.75rem;
			color: var(--fg-faint);
			font-size: 0.75rem;
			font-weight: 700;
			letter-spacing: 0.08em;
			text-transform: uppercase;
		}
		aside .group:first-child {
			margin-top: 0;
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

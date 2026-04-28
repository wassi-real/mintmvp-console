<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import {
		Key, BookOpen, Plus, Trash2, Loader, X, Copy, Check,
		ChevronDown, ChevronUp, Menu, Terminal
	} from 'lucide-svelte';

	let { data } = $props();

	type Tab = 'docs' | 'keys';
	let activeTab = $state<Tab>('docs');
	let mobileSidebarOpen = $state(false);

	// ── API Keys state ─────────────────────────────────────
	let apiKeys: any[] = $state([]);
	$effect(() => { apiKeys = [...data.apiKeys]; });

	let createOpen = $state(false);
	let createName = $state('');
	let createSubmitting = $state(false);
	let createError = $state('');

	let newlyCreatedKey = $state<string | null>(null);
	let copied = $state(false);

	let deleteTarget = $state<any>(null);
	let deleteSubmitting = $state(false);

	function timeAgo(d: string | null) {
		if (!d) return 'Never';
		const diff = Date.now() - new Date(d).getTime();
		const m = Math.floor(diff / 60000);
		if (m < 60) return `${m}m ago`;
		const h = Math.floor(m / 60);
		if (h < 24) return `${h}h ago`;
		return `${Math.floor(h / 24)}d ago`;
	}

	async function copyKey() {
		if (!newlyCreatedKey) return;
		await navigator.clipboard.writeText(newlyCreatedKey);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}

	function closeKeyModal() {
		newlyCreatedKey = null;
		copied = false;
	}

	function selectTab(tab: Tab) {
		activeTab = tab;
		mobileSidebarOpen = false;
	}

	// ── Docs state ─────────────────────────────────────────
	let expandedDoc = $state<string | null>(null);

	function toggleDoc(id: string) {
		expandedDoc = expandedDoc === id ? null : id;
	}

	const projectId = $derived($page.params.id);
	const baseUrl = $derived($page.url.origin + '/api/v1/projects/' + projectId);

	const endpoints = [
		{
			id: 'specs',
			label: 'Specs',
			paramName: 'specId',
			get: { desc: 'List all specs', response: '{ "data": [ { id, project_id, title, summary, goal, status, ... } ] }' },
			post: {
				desc: 'Create a spec',
				body: '{ "title": "Feature X", "summary": "...", "goal": "...", "status": "draft" }',
				required: ['title'],
				optional: ['summary', 'goal', 'acceptance_criteria', 'edge_cases', 'regression_risks', 'status']
			},
			patch: {
				desc: 'Update a spec (partial)',
				body: '{ "summary": "...", "acceptance_criteria": "...", "edge_cases": "...", "regression_risks": "..." }',
				optional: ['title', 'summary', 'goal', 'acceptance_criteria', 'edge_cases', 'regression_risks', 'status']
			},
			del: { desc: 'Delete a spec' }
		},
		{
			id: 'milestones',
			label: 'Milestones',
			paramName: 'milestoneId',
			get: {
				desc: 'List milestones with nested slices and linked_task_ids',
				response:
					'{ "data": [ { …milestone columns…, "slices": [...], "linked_task_ids": ["uuid"] } ], "meta": { "phase_descriptions": { "discovery": "…", … } } }'
			},
			getOne: {
				desc: 'Get one milestone with full columns, sorted slices, linked_task ids, and phase_descriptions',
				response:
					'{ "data": { …milestone…, "slices": [...], "linked_task_ids": [...] }, "meta": { "phase_descriptions": { … } } }'
			},
			post: {
				desc: 'Create a milestone (same validation as the Milestones UI)',
				body:
					'{ "title": "Beta launch", "description": "Ship MVP", "estimate": "40h", "due_date": "2026-05-01", "approval_owner_user_id": "<org-user-uuid>", "entry_gate": "Spec approved", "exit_gate": "Deployed to prod", "test_gate_required_tests": "Smoke + regression", "test_gate_pass_threshold": "100% smoke", "test_gate_environment": "staging", "linked_task_ids": [], "slices": [] }',
				required: [
					'title',
					'description',
					'estimate',
					'due_date',
					'approval_owner_user_id',
					'entry_gate',
					'exit_gate',
					'test_gate_required_tests',
					'test_gate_pass_threshold',
					'test_gate_environment'
				],
				optional: [
					'priority',
					'phase',
					'spec_id',
					'owner_user_id',
					'notes',
					'dependencies',
					'risks_blockers',
					'deliverables',
					'amount',
					'status',
					'paid_date',
					'attach_bill',
					'bill_amount',
					'bill_status',
					'linked_task_ids',
					'slices',
					'slices_json'
				]
			},
			patch: {
				desc: 'Update a milestone (partial merge — omitted fields stay unchanged)',
				body: '{ "title": "Beta launch (delayed)" }',
				optional: [
					'title',
					'description',
					'estimate',
					'due_date',
					'approval_owner_user_id',
					'entry_gate',
					'exit_gate',
					'test_gate_required_tests',
					'test_gate_pass_threshold',
					'test_gate_environment',
					'priority',
					'phase',
					'spec_id',
					'owner_user_id',
					'notes',
					'dependencies',
					'risks_blockers',
					'deliverables',
					'amount',
					'status',
					'paid_date',
					'attach_bill',
					'bill_amount',
					'bill_status',
					'linked_task_ids',
					'slices',
					'slices_json'
				]
			},
			del: { desc: 'Delete a milestone' }
		},
		{
			id: 'tasks',
			label: 'Tasks',
			paramName: 'taskId',
			get: { desc: 'List all tasks', response: '{ "data": [ { id, title, status, priority, assignee, branch_name, ... } ] }' },
			post: {
				desc: 'Create a task',
				body: '{ "title": "Fix bug", "priority": "high", "status": "backlog" }',
				required: ['title'],
				optional: ['description', 'status', 'priority', 'assignee', 'spec_id', 'branch_name']
			},
			patch: {
				desc: 'Update a task (partial)',
				body: '{ "status": "in_progress", "priority": "high" }',
				optional: ['title', 'description', 'status', 'priority', 'assignee', 'spec_id', 'branch_name']
			},
			del: { desc: 'Delete a task' }
		},
		{
			id: 'tests',
			label: 'Tests',
			paramName: 'testId',
			get: { desc: 'List all tests', response: '{ "data": [ { id, name, type, status, source, linked_commit, last_run, notes, spec_id, task_id } ] }' },
			post: {
				desc: 'Create a test',
				body: '{ "name": "Login flow", "type": "e2e", "status": "pending" }',
				required: ['name'],
				optional: ['type', 'status', 'notes', 'spec_id', 'task_id', 'source', 'linked_commit']
			},
			patch: {
				desc: 'Update a test (partial)',
				body: '{ "status": "pass", "notes": "All assertions passed" }',
				optional: ['name', 'type', 'status', 'last_run', 'notes', 'spec_id', 'task_id', 'source', 'linked_commit']
			},
			del: { desc: 'Delete a test' }
		},
		{
			id: 'incidents',
			label: 'Incidents',
			paramName: 'incidentId',
			get: { desc: 'List all incidents', response: '{ "data": [ { id, title, severity, status, description, ... } ] }' },
			post: {
				desc: 'Report an incident',
				body: '{ "title": "API down", "severity": "critical" }',
				required: ['title'],
				optional: ['severity', 'status', 'description']
			},
			patch: {
				desc: 'Update an incident (partial)',
				body: '{ "status": "resolved", "resolved_at": "2026-03-16T12:00:00Z" }',
				optional: ['title', 'severity', 'status', 'description', 'resolved_at']
			},
			del: { desc: 'Delete an incident' }
		},
		{
			id: 'reports',
			label: 'Reports',
			paramName: 'reportId',
			get: { desc: 'List all reports', response: '{ "data": [ { id, title, content, created_by, ... } ] }' },
			post: {
				desc: 'Create a report',
				body: '{ "title": "Sprint 1 Summary", "content": "# Report\\n..." }',
				required: ['title'],
				optional: ['content']
			},
			patch: {
				desc: 'Update a report (partial)',
				body: '{ "title": "Sprint 1 Summary (final)", "content": "# Updated\\n..." }',
				optional: ['title', 'content']
			},
			del: { desc: 'Delete a report' }
		}
	];
</script>

<div class="absolute inset-0 flex flex-col overflow-hidden">

	<!-- Mobile top bar -->
	<div class="flex shrink-0 items-center gap-2 border-b border-border bg-card px-3 py-2 sm:hidden">
		<button
			onclick={() => (mobileSidebarOpen = !mobileSidebarOpen)}
			class="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground"
			aria-label="Toggle sidebar"
		>
			{#if mobileSidebarOpen}<X size={20} />{:else}<Menu size={20} />{/if}
		</button>
		<span class="text-base font-semibold text-foreground">{activeTab === 'docs' ? 'API Docs' : 'API Keys'}</span>
	</div>

	<div class="flex flex-1 overflow-hidden">

		<!-- ── Inner sidebar ──────────────────────────────── -->
		<aside class="
			flex shrink-0 flex-col border-r border-border bg-card overflow-hidden
			w-full sm:w-56
			{mobileSidebarOpen ? 'flex' : 'hidden'} sm:flex
		">
			<div class="border-b border-border px-4 py-4">
				<span class="text-base font-semibold text-foreground">API</span>
			</div>
			<div class="flex flex-col gap-1 p-3">
				<button
					onclick={() => selectTab('docs')}
					class="flex items-center gap-3 rounded-lg px-4 py-3 text-left text-base font-medium transition-colors {activeTab === 'docs' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}"
				>
					<BookOpen size={18} /> Docs
				</button>
				<button
					onclick={() => selectTab('keys')}
					class="flex items-center gap-3 rounded-lg px-4 py-3 text-left text-base font-medium transition-colors {activeTab === 'keys' ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}"
				>
					<Key size={18} /> API Keys
				</button>
			</div>
		</aside>

		<!-- ── Content pane ───────────────────────────────── -->
		<div class="flex flex-1 flex-col overflow-y-auto {mobileSidebarOpen ? 'hidden sm:flex' : 'flex'}">

			{#if activeTab === 'keys'}
				<!-- ═══════════ API KEYS TAB ═══════════ -->
				<div class="p-4 sm:p-6 lg:p-8">
					<div class="flex flex-wrap items-start justify-between gap-4">
						<div>
							<h2 class="text-2xl font-bold text-foreground sm:text-3xl">API Keys</h2>
							<p class="mt-1 text-base text-muted-foreground">Manage keys for programmatic access</p>
						</div>
						<button
							onclick={() => { createName = ''; createError = ''; createOpen = true; }}
							class="flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90"
						>
							<Plus size={20} /> Create Key
						</button>
					</div>

					<!-- Inline create form -->
					{#if createOpen}
						<form
							method="POST"
							action="?/create"
							use:enhance={() => { createSubmitting = true; createError = '';
								return async ({ result }) => {
									createSubmitting = false;
									if (result.type === 'failure') {
										createError = (result.data as any)?.error ?? 'Error';
									} else {
										createOpen = false;
										if (result.type === 'success' && (result.data as any)?.rawKey) {
											newlyCreatedKey = (result.data as any).rawKey;
										}
										await invalidateAll();
									}
								};
							}}
							class="mt-6 rounded-xl border border-border bg-card p-6"
						>
							{#if createError}<div class="mb-4 rounded-lg bg-red-900/30 px-4 py-3 text-base text-red-300">{createError}</div>{/if}
							<label for="key-name" class="mb-1 block text-base font-medium text-foreground">Key Name <span class="text-destructive">*</span></label>
							<input id="key-name" name="name" bind:value={createName} required placeholder="e.g. CI Pipeline" class="w-full max-w-md rounded-lg border border-input bg-background px-4 py-3 text-lg text-foreground" />
							<div class="mt-4 flex gap-3">
								<button type="submit" disabled={createSubmitting} class="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60">
									{#if createSubmitting}<Loader size={18} class="animate-spin" />Creating...{:else}Create Key{/if}
								</button>
								<button type="button" onclick={() => (createOpen = false)} class="rounded-lg bg-secondary px-6 py-3 text-base font-medium text-foreground hover:bg-accent">Cancel</button>
							</div>
						</form>
					{/if}

					<!-- Keys list -->
					{#if apiKeys.length === 0 && !createOpen}
						<div class="mt-12 flex flex-col items-center gap-4 text-muted-foreground">
							<Key size={48} class="opacity-20" />
							<p class="text-lg font-medium">No API keys yet</p>
							<p class="text-base">Create a key to start using the REST API</p>
						</div>
					{:else}
						<div class="mt-6 overflow-hidden rounded-xl border border-border">
							<table class="w-full text-left">
								<thead class="border-b border-border bg-secondary/50">
									<tr>
										<th class="px-6 py-4 text-base font-semibold text-foreground">Name</th>
										<th class="px-6 py-4 text-base font-semibold text-foreground">Key</th>
										<th class="hidden px-6 py-4 text-base font-semibold text-foreground sm:table-cell">Created</th>
										<th class="hidden px-6 py-4 text-base font-semibold text-foreground sm:table-cell">Last Used</th>
										<th class="px-6 py-4"></th>
									</tr>
								</thead>
								<tbody>
									{#each apiKeys as key}
										<tr class="group border-b border-border transition-colors hover:bg-secondary/30">
											<td class="px-6 py-4 text-lg font-semibold text-foreground">{key.name}</td>
											<td class="px-6 py-4">
												<code class="rounded bg-secondary px-2 py-1 text-sm font-mono text-muted-foreground">{key.key_prefix}</code>
											</td>
											<td class="hidden px-6 py-4 text-base text-muted-foreground sm:table-cell">{timeAgo(key.created_at)}</td>
											<td class="hidden px-6 py-4 text-base text-muted-foreground sm:table-cell">{timeAgo(key.last_used_at)}</td>
											<td class="px-6 py-4">
												<button
													onclick={() => (deleteTarget = key)}
													class="rounded p-2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-900/40 hover:text-red-300"
													aria-label="Delete key"
												>
													<Trash2 size={16} />
												</button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>

			{:else}
				<!-- ═══════════ DOCS TAB ═══════════ -->
				<div class="p-4 sm:p-6 lg:p-8">
					<h2 class="text-2xl font-bold text-foreground sm:text-3xl">API Documentation</h2>
					<p class="mt-1 text-base text-muted-foreground">Interact with the console programmatically</p>

					<!-- Auth section -->
					<div class="mt-8 rounded-xl border border-border bg-card p-6">
						<h3 class="text-xl font-bold text-foreground">Authentication</h3>
						<p class="mt-2 text-base text-foreground">All requests require a Bearer token in the <code class="rounded bg-secondary px-1.5 py-0.5 text-sm font-mono text-primary">Authorization</code> header.</p>
						<div class="mt-4 rounded-lg bg-secondary p-4">
							<pre class="text-sm font-mono text-foreground overflow-x-auto">Authorization: Bearer mint_your_api_key_here</pre>
						</div>
						<p class="mt-3 text-sm text-muted-foreground">Generate keys in the <button onclick={() => selectTab('keys')} class="font-semibold text-primary hover:underline">API Keys</button> tab. Each key is scoped to this project.</p>
					</div>

					<!-- Base URL -->
					<div class="mt-6 rounded-xl border border-border bg-card p-6">
						<h3 class="text-xl font-bold text-foreground">Base URL</h3>
						<div class="mt-3 rounded-lg bg-secondary p-4">
							<code class="text-sm font-mono text-foreground break-all">{baseUrl}</code>
						</div>
					</div>

					<!-- Server env (REST validates keys with service role) -->
					<!-- <div class="mt-6 rounded-xl border border-amber-900/50 bg-amber-950/20 p-6">
						<h3 class="text-xl font-bold text-foreground">Server configuration</h3>
						<p class="mt-2 text-base text-muted-foreground">
							The REST API validates keys using Supabase’s <strong class="text-foreground">service role</strong> on the server (never exposed to the browser).
							Add <code class="rounded bg-secondary px-1.5 py-0.5 text-sm font-mono text-primary">SUPABASE_SERVICE_ROLE_KEY</code> to your
							<code class="rounded bg-secondary px-1.5 text-sm font-mono">.env</code>
							(Supabase Dashboard → Project Settings → API → <em>service_role</em> secret). Without it, requests return 401 or 500.
						</p>
					</div> -->

					<!-- Endpoints -->
					<div class="mt-6 space-y-3">
						{#each endpoints as ep}
							<div class="rounded-xl border border-border bg-card">
								<button
									onclick={() => toggleDoc(ep.id)}
									class="flex w-full items-center justify-between px-6 py-5 text-left"
								>
									<div class="flex items-center gap-3">
										{#if 'readOnly' in ep && ep.readOnly}
											<span class="rounded bg-green-900/40 px-2 py-0.5 text-xs font-bold text-green-400">GET</span>
										{:else}
											<span class="rounded bg-green-900/40 px-2 py-0.5 text-xs font-bold text-green-400">GET</span>
											<span class="rounded bg-blue-900/40 px-2 py-0.5 text-xs font-bold text-blue-400">POST</span>
											{#if ep.patch}
												<span class="rounded bg-amber-900/40 px-2 py-0.5 text-xs font-bold text-amber-400">PATCH</span>
											{/if}
											{#if ep.del}
												<span class="rounded bg-red-900/40 px-2 py-0.5 text-xs font-bold text-red-400">DELETE</span>
											{/if}
										{/if}
										<span class="text-lg font-semibold text-foreground">/{ep.id}</span>
									</div>
									{#if expandedDoc === ep.id}
										<ChevronUp size={20} class="text-muted-foreground" />
									{:else}
										<ChevronDown size={20} class="text-muted-foreground" />
									{/if}
								</button>

								{#if expandedDoc === ep.id}
									<div class="border-t border-border px-6 py-5 space-y-6">
										<!-- GET (list) -->
										<div>
											<div class="flex items-center gap-2">
												<span class="rounded bg-green-900/40 px-2 py-0.5 text-xs font-bold text-green-400">GET</span>
												<span class="text-base font-semibold text-foreground">{ep.get.desc}</span>
											</div>
											<div class="mt-3 rounded-lg bg-secondary p-4">
												<p class="mb-1 text-xs font-semibold uppercase text-muted-foreground">curl</p>
												<pre class="text-sm font-mono text-foreground overflow-x-auto whitespace-pre-wrap">curl -H "Authorization: Bearer mint_YOUR_KEY" \
  {baseUrl}/{ep.id}</pre>
											</div>
											<div class="mt-3 rounded-lg bg-secondary p-4">
												<p class="mb-1 text-xs font-semibold uppercase text-muted-foreground">Response</p>
												<pre class="text-sm font-mono text-foreground overflow-x-auto whitespace-pre-wrap">{ep.get.response}</pre>
											</div>
										</div>

										<!-- GET (single) -->
										<div>
											<div class="flex items-center gap-2">
												<span class="rounded bg-green-900/40 px-2 py-0.5 text-xs font-bold text-green-400">GET</span>
												<span class="text-base font-semibold text-foreground"
													>{ep.getOne?.desc ?? `Get a single ${ep.label.toLowerCase().replace(/s$/, '')}`}</span
												>
											</div>
											<p class="mt-2 text-sm text-muted-foreground">
												Path: <code class="rounded bg-secondary px-1.5 py-0.5 font-mono text-foreground"
													>/{ep.id}/&#123;{ep.paramName ?? 'id'}&#125;</code
												>
											</p>
											<div class="mt-3 rounded-lg bg-secondary p-4">
												<p class="mb-1 text-xs font-semibold uppercase text-muted-foreground">curl</p>
												<pre class="text-sm font-mono text-foreground overflow-x-auto whitespace-pre-wrap">curl -H "Authorization: Bearer mint_YOUR_KEY" \
  {baseUrl}/{ep.id}/ITEM_UUID</pre>
											</div>
											{#if ep.getOne?.response}
												<div class="mt-3 rounded-lg bg-secondary p-4">
													<p class="mb-1 text-xs font-semibold uppercase text-muted-foreground">Response</p>
													<pre class="text-sm font-mono text-foreground overflow-x-auto whitespace-pre-wrap">{ep.getOne.response}</pre>
												</div>
											{/if}
										</div>

										{#if ep.post}
										<!-- POST -->
										<div>
											<div class="flex items-center gap-2">
												<span class="rounded bg-blue-900/40 px-2 py-0.5 text-xs font-bold text-blue-400">POST</span>
												<span class="text-base font-semibold text-foreground">{ep.post.desc}</span>
											</div>
											<div class="mt-2">
												<p class="text-sm text-muted-foreground">
													<strong class="text-foreground">Required:</strong> {ep.post.required.join(', ')}
												</p>
												{#if ep.post.optional.length}
													<p class="text-sm text-muted-foreground">
														<strong class="text-foreground">Optional:</strong> {ep.post.optional.join(', ')}
													</p>
												{/if}
											</div>
											<div class="mt-3 rounded-lg bg-secondary p-4">
												<p class="mb-1 text-xs font-semibold uppercase text-muted-foreground">curl</p>
												<pre class="text-sm font-mono text-foreground overflow-x-auto whitespace-pre-wrap">curl -X POST \
  -H "Authorization: Bearer mint_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{ep.post.body}' \
  {baseUrl}/{ep.id}</pre>
											</div>
										</div>
										{/if}

										{#if ep.patch}
											<!-- PATCH -->
											<div>
												<div class="flex items-center gap-2">
													<span class="rounded bg-amber-900/40 px-2 py-0.5 text-xs font-bold text-amber-400">PATCH</span>
													<span class="text-base font-semibold text-foreground">{ep.patch.desc}</span>
												</div>
												<p class="mt-2 text-sm text-muted-foreground">
													Path: <code class="rounded bg-secondary px-1.5 py-0.5 font-mono text-foreground">/{ep.id}/&#123;id&#125;</code>
												</p>
												<div class="mt-2">
													<p class="text-sm text-muted-foreground">
														<strong class="text-foreground">Optional (send any subset):</strong>
														{ep.patch.optional.join(', ')}
													</p>
												</div>
												<div class="mt-3 rounded-lg bg-secondary p-4">
													<p class="mb-1 text-xs font-semibold uppercase text-muted-foreground">curl</p>
													<pre class="text-sm font-mono text-foreground overflow-x-auto whitespace-pre-wrap">curl -X PATCH \
  -H "Authorization: Bearer mint_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{ep.patch.body}' \
  {baseUrl}/{ep.id}/ITEM_UUID</pre>
												</div>
											</div>
										{/if}

										{#if ep.del}
											<!-- DELETE -->
											<div>
												<div class="flex items-center gap-2">
													<span class="rounded bg-red-900/40 px-2 py-0.5 text-xs font-bold text-red-400">DELETE</span>
													<span class="text-base font-semibold text-foreground">{ep.del.desc}</span>
												</div>
												<p class="mt-2 text-sm text-muted-foreground">
													Path: <code class="rounded bg-secondary px-1.5 py-0.5 font-mono text-foreground">/{ep.id}/&#123;id&#125;</code>
												</p>
												<div class="mt-3 rounded-lg bg-secondary p-4">
													<p class="mb-1 text-xs font-semibold uppercase text-muted-foreground">curl</p>
													<pre class="text-sm font-mono text-foreground overflow-x-auto whitespace-pre-wrap">curl -X DELETE \
  -H "Authorization: Bearer mint_YOUR_KEY" \
  {baseUrl}/{ep.id}/ITEM_UUID</pre>
												</div>
												<div class="mt-3 rounded-lg bg-secondary p-4">
													<p class="mb-1 text-xs font-semibold uppercase text-muted-foreground">Response</p>
													<pre class="text-sm font-mono text-foreground overflow-x-auto whitespace-pre-wrap">{"{ \"success\": true }"}</pre>
												</div>
											</div>
										{/if}

										{#if 'readOnly' in ep && ep.readOnly}
											<p class="text-sm text-muted-foreground">
												Read-only in the API — create and edit milestones in the project <strong class="text-foreground">Milestones</strong> screen.
											</p>
										{/if}
									</div>
								{/if}
							</div>
						{/each}
					</div>

					<!-- Enum reference -->
					<div class="mt-6 rounded-xl border border-border bg-card p-6">
						<h3 class="text-xl font-bold text-foreground">Accepted Enum Values</h3>
						<p class="mt-2 text-sm text-muted-foreground">Fields are validated server-side. Common aliases (e.g. "in progress" → "in_progress") are mapped automatically.</p>
						<div class="mt-4 overflow-x-auto rounded-lg border border-border">
							<table class="w-full text-left">
								<thead class="border-b border-border bg-secondary/50">
									<tr>
										<th class="whitespace-nowrap px-4 py-3 text-sm font-semibold text-foreground">Resource</th>
										<th class="whitespace-nowrap px-4 py-3 text-sm font-semibold text-foreground">Field</th>
										<th class="px-4 py-3 text-sm font-semibold text-foreground">Values</th>
									</tr>
								</thead>
								<tbody>
									<tr class="border-b border-border"><td class="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-foreground">Milestones · slices</td><td class="whitespace-nowrap px-4 py-2.5 text-sm text-muted-foreground">phase</td><td class="px-4 py-2.5 text-sm text-muted-foreground"><code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">discovery</code> … <code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">closed</code> (same enum on milestones and milestone_slices)</td></tr>
									<tr class="border-b border-border"><td class="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-foreground">Slices</td><td class="whitespace-nowrap px-4 py-2.5 text-sm text-muted-foreground">status</td><td class="px-4 py-2.5 text-sm text-muted-foreground"><code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">pending</code> <code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">in_progress</code> <code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">done</code> <code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">blocked</code></td></tr>
									<tr class="border-b border-border"><td class="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-foreground">Specs</td><td class="whitespace-nowrap px-4 py-2.5 text-sm text-muted-foreground">status</td><td class="px-4 py-2.5 text-sm text-muted-foreground"><code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">draft</code> <code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">approved</code> <code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">in_dev</code> <code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">completed</code></td></tr>
									<tr class="border-b border-border"><td class="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-foreground">Tasks</td><td class="whitespace-nowrap px-4 py-2.5 text-sm text-muted-foreground">status</td><td class="px-4 py-2.5 text-sm text-muted-foreground"><code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">backlog</code> <code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">in_progress</code> <code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">review</code> <code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">testing</code> <code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">deployed</code></td></tr>
									<tr class="border-b border-border"><td class="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-foreground">Tasks</td><td class="whitespace-nowrap px-4 py-2.5 text-sm text-muted-foreground">priority</td><td class="px-4 py-2.5 text-sm text-muted-foreground"><code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">low</code> <code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">medium</code> <code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">high</code> <code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">critical</code></td></tr>
									<tr class="border-b border-border"><td class="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-foreground">Tests</td><td class="whitespace-nowrap px-4 py-2.5 text-sm text-muted-foreground">type</td><td class="px-4 py-2.5 text-sm text-muted-foreground"><code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">unit</code> <code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">integration</code> <code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">e2e</code> <code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">smoke</code> <code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">manual</code></td></tr>
									<tr class="border-b border-border"><td class="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-foreground">Tests</td><td class="whitespace-nowrap px-4 py-2.5 text-sm text-muted-foreground">status</td><td class="px-4 py-2.5 text-sm text-muted-foreground"><code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">pass</code> <code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">fail</code> <code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">pending</code></td></tr>
									<tr class="border-b border-border"><td class="whitespace-nowrap px-4 py-2.5 text-sm font-medium text-foreground">Incidents</td><td class="whitespace-nowrap px-4 py-2.5 text-sm text-muted-foreground">severity</td><td class="px-4 py-2.5 text-sm text-muted-foreground"><code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">low</code> <code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">medium</code> <code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">high</code> <code class="rounded bg-secondary px-1 py-0.5 text-xs font-mono">critical</code></td></tr>
								</tbody>
							</table>
						</div>
					</div>

					<!-- Error codes -->
					<div class="mt-6 rounded-xl border border-border bg-card p-6">
						<h3 class="text-xl font-bold text-foreground">Error Codes</h3>
						<div class="mt-4 overflow-hidden rounded-lg border border-border">
							<table class="w-full text-left">
								<thead class="border-b border-border bg-secondary/50">
									<tr>
										<th class="px-4 py-3 text-sm font-semibold text-foreground">Code</th>
										<th class="px-4 py-3 text-sm font-semibold text-foreground">Meaning</th>
									</tr>
								</thead>
								<tbody>
									<tr class="border-b border-border"><td class="px-4 py-3 font-mono text-sm text-foreground">200</td><td class="px-4 py-3 text-sm text-muted-foreground">Success</td></tr>
									<tr class="border-b border-border"><td class="px-4 py-3 font-mono text-sm text-foreground">201</td><td class="px-4 py-3 text-sm text-muted-foreground">Created</td></tr>
									<tr class="border-b border-border"><td class="px-4 py-3 font-mono text-sm text-foreground">400</td><td class="px-4 py-3 text-sm text-muted-foreground">Bad request (missing required fields)</td></tr>
									<tr class="border-b border-border"><td class="px-4 py-3 font-mono text-sm text-foreground">404</td><td class="px-4 py-3 text-sm text-muted-foreground">Not found (e.g. spec id does not exist in this project)</td></tr>
									<tr class="border-b border-border"><td class="px-4 py-3 font-mono text-sm text-foreground">401</td><td class="px-4 py-3 text-sm text-muted-foreground">Unauthorized (invalid or missing API key)</td></tr>
									<tr class="border-b border-border"><td class="px-4 py-3 font-mono text-sm text-foreground">403</td><td class="px-4 py-3 text-sm text-muted-foreground">Forbidden (key does not belong to this project)</td></tr>
									<tr><td class="px-4 py-3 font-mono text-sm text-foreground">500</td><td class="px-4 py-3 text-sm text-muted-foreground">Internal server error</td></tr>
								</tbody>
							</table>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- ── New key reveal modal ──────────────────────────────── -->
{#if newlyCreatedKey}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
		<div class="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-2xl">
			<h3 class="text-xl font-semibold text-foreground">Your API Key</h3>
			<p class="mt-2 text-base text-amber-400 font-medium">Copy this key now. It will not be shown again.</p>
			<div class="mt-4 flex items-center gap-2 rounded-lg border border-border bg-secondary p-4">
				<code class="flex-1 break-all font-mono text-sm text-foreground">{newlyCreatedKey}</code>
				<button onclick={copyKey} class="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90">
					{#if copied}<Check size={16} />{:else}<Copy size={16} />{/if}
				</button>
			</div>
			<div class="mt-6 flex justify-end">
				<button onclick={closeKeyModal} class="rounded-lg bg-secondary px-6 py-3 text-base font-medium text-foreground hover:bg-accent">Done</button>
			</div>
		</div>
	</div>
{/if}

<!-- ── Delete confirm modal ──────────────────────────────── -->
{#if deleteTarget}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
		<div class="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
			<h3 class="text-xl font-semibold text-foreground">Revoke API Key</h3>
			<p class="mt-2 text-base text-foreground">Revoke <strong>{deleteTarget.name}</strong> (<code class="text-sm font-mono">{deleteTarget.key_prefix}</code>)?</p>
			<p class="mt-1 text-sm text-muted-foreground">Any integrations using this key will immediately stop working.</p>
			<form method="POST" action="?/delete"
				use:enhance={() => { deleteSubmitting = true;
					return async ({ result }) => {
						deleteSubmitting = false;
						if (result.type !== 'failure') {
							apiKeys = apiKeys.filter(k => k.id !== deleteTarget.id);
							deleteTarget = null;
							await invalidateAll();
						}
					};
				}}
			>
				<input type="hidden" name="id" value={deleteTarget.id} />
				<div class="mt-6 flex gap-3">
					<button type="submit" disabled={deleteSubmitting} class="flex items-center gap-2 rounded-lg bg-destructive px-6 py-3 text-base font-semibold text-white hover:bg-destructive/90 disabled:opacity-60">
						{#if deleteSubmitting}<Loader size={18} class="animate-spin" />Revoking...{:else}<Trash2 size={18} />Revoke Key{/if}
					</button>
					<button type="button" onclick={() => (deleteTarget = null)} class="rounded-lg bg-secondary px-6 py-3 text-base font-medium text-foreground hover:bg-accent">Cancel</button>
				</div>
			</form>
		</div>
	</div>
{/if}

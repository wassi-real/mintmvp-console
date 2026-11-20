<script lang="ts" module>
	import type { Option } from '#lib/constants.ts';

	export type DataRow = Record<string, unknown> & { id: string };

	export interface Column {
		key: string;
		label: string;
		kind?: 'text' | 'badge' | 'date' | 'time' | 'money' | 'mono' | 'url' | 'number';
		/** For badges: turns the stored value into a label and colour. */
		option?: (value: string | null | undefined) => Option;
		/** The main column: shown bold, and linked when rowHref is set. */
		primary?: boolean;
		/** Smaller grey text under the main value. */
		sub?: (row: DataRow) => string;
		/** Computed value instead of row[key]. */
		value?: (row: DataRow) => unknown;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Plus from '@lucide/svelte/icons/plus';
	import Search from '@lucide/svelte/icons/search';
	import Trash from '@lucide/svelte/icons/trash';
	import type { Field } from '#lib/fields.ts';
	import { formatDate, formatMoney, formatNumber } from '#lib/format.ts';
	import Badge from './Badge.svelte';
	import ConfirmDialog from './ConfirmDialog.svelte';
	import EmptyState from './EmptyState.svelte';
	import RecordDialog from './RecordDialog.svelte';
	import Time from './Time.svelte';

	interface Props {
		/** Heading of the block. */
		title: string;
		/** Singular lower-case name, for example "incident". */
		noun: string;
		rows: DataRow[];
		columns: Column[];
		/** Form definition. Leave out for read-only data. */
		fields?: readonly Field[];
		canEdit?: boolean;
		canCreate?: boolean;
		canDelete?: boolean;
		createAction?: string;
		updateAction?: string;
		deleteAction?: string;
		/** Column used to name the record in the delete confirmation. */
		titleKey?: string;
		rowHref?: (row: DataRow) => string;
		emptyTitle?: string;
		emptyMessage?: string;
		/** Show a search box when there are more rows than this. */
		searchFrom?: number;
		dialogSize?: 'md' | 'lg';
		/** Extra buttons per row, before edit and delete. */
		rowActions?: Snippet<[DataRow]>;
		/** Extra buttons in the heading. */
		actions?: Snippet;
		/** Open the "new" form from outside. */
		creating?: boolean;
	}

	let {
		title,
		noun,
		rows,
		columns,
		fields,
		canEdit = false,
		canCreate = true,
		canDelete = true,
		createAction = '?/create',
		updateAction = '?/update',
		deleteAction = '?/delete',
		titleKey = 'title',
		rowHref,
		emptyTitle,
		emptyMessage,
		searchFrom = 8,
		dialogSize = 'md',
		rowActions,
		actions,
		creating = $bindable(false)
	}: Props = $props();

	let editing = $state<DataRow | null>(null);
	let editOpen = $state(false);
	let deleting = $state<DataRow | null>(null);
	let deleteOpen = $state(false);
	let query = $state('');

	const editable = $derived(canEdit && Boolean(fields));
	const hasRowButtons = $derived(editable || Boolean(rowActions));

	const visible = $derived.by(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) return rows;
		return rows.filter((row) =>
			columns.some((column) => String(cell(row, column) ?? '').toLowerCase().includes(needle))
		);
	});

	function cell(row: DataRow, column: Column): unknown {
		return column.value ? column.value(row) : row[column.key];
	}

	function asText(value: unknown): string {
		if (value === null || value === undefined) return '';
		return Array.isArray(value) ? value.join(', ') : String(value);
	}

	function openCreate() {
		editing = null;
		editOpen = true;
	}

	$effect(() => {
		if (creating) {
			creating = false;
			openCreate();
		}
	});
</script>

<section class="panel">
	<header class="panel-header">
		<h2 class="panel-title flex items-center gap-3">
			{title}
			<span class="chip tabular-nums text-muted">{formatNumber(rows.length)}</span>
		</h2>
		<div class="flex flex-wrap items-center gap-3">
			{#if rows.length > searchFrom}
				<label class="relative block">
					<span class="sr-only">Search {title}</span>
					<Search
						size={18}
						class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-faint"
					/>
					<input
						type="search"
						class="input min-h-10! w-56 py-1.5! pl-10!"
						placeholder="Search"
						bind:value={query}
					/>
				</label>
			{/if}
			{@render actions?.()}
			{#if editable && canCreate}
				<button type="button" class="btn btn-primary btn-sm" onclick={openCreate}>
					<Plus size={18} /> New {noun}
				</button>
			{/if}
		</div>
	</header>

	{#if rows.length === 0}
		<div class="p-5">
			<EmptyState
				title={emptyTitle ?? `No ${title.toLowerCase()} yet`}
				message={emptyMessage ??
					(editable && canCreate ? `Add the first ${noun} to get started.` : undefined)}
			>
				{#if editable && canCreate}
					<button type="button" class="btn btn-primary" onclick={openCreate}>
						<Plus size={18} /> New {noun}
					</button>
				{/if}
			</EmptyState>
		</div>
	{:else if visible.length === 0}
		<p class="px-6 py-10 text-center text-muted">Nothing matches “{query}”.</p>
	{:else}
		<div class="table-wrap">
			<table class="table">
				<thead>
					<tr>
						{#each columns as column (column.key)}
							<th scope="col" class={column.kind === 'money' || column.kind === 'number' ? 'text-right!' : ''}>
								{column.label}
							</th>
						{/each}
						{#if hasRowButtons}
							<th scope="col"><span class="sr-only">Actions</span></th>
						{/if}
					</tr>
				</thead>
				<tbody>
					{#each visible as row (row.id)}
						<tr>
							{#each columns as column (column.key)}
								{@const value = cell(row, column)}
								<td
									class={column.kind === 'money' || column.kind === 'number'
										? 'text-right tabular-nums'
										: column.primary
											? 'min-w-56'
											: ''}
								>
									{#if column.primary}
										{#if rowHref}
											<a href={rowHref(row)} class="link font-semibold">{asText(value) || 'Untitled'}</a>
										{:else}
											<span class="font-semibold">{asText(value) || 'Untitled'}</span>
										{/if}
										{#if column.sub && column.sub(row)}
											<span class="mt-0.5 line-clamp-2 block text-[0.88rem] text-muted">
												{column.sub(row)}
											</span>
										{/if}
									{:else if column.kind === 'badge' && column.option}
										{#if value === null || value === undefined || value === ''}
											<span class="text-faint">—</span>
										{:else}
											<Badge option={column.option(asText(value))} />
										{/if}
									{:else if column.kind === 'date'}
										<span class="whitespace-nowrap">{formatDate(asText(value)) || '—'}</span>
									{:else if column.kind === 'time'}
										<span class="whitespace-nowrap text-muted">
											<Time value={asText(value) || null} relative fallback="—" />
										</span>
									{:else if column.kind === 'money'}
										{formatMoney(Number(value ?? 0))}
									{:else if column.kind === 'number'}
										{formatNumber(Number(value ?? 0))}
									{:else if column.kind === 'mono'}
										<span class="mono">{asText(value) || '—'}</span>
									{:else if column.kind === 'url'}
										{#if asText(value)}
											<a
												href={asText(value)}
												class="link inline-flex items-center gap-1.5"
												target="_blank"
												rel="noreferrer"
											>
												{asText(value).replace(/^https?:\/\//, '')}
												<ExternalLink size={14} />
											</a>
										{:else}
											<span class="text-faint">Not set</span>
										{/if}
									{:else}
										<span class="line-clamp-2">{asText(value) || '—'}</span>
									{/if}
								</td>
							{/each}
							{#if hasRowButtons}
								<td class="w-px">
									<div class="flex justify-end gap-1.5">
										{@render rowActions?.(row)}
										{#if editable}
											<button
												type="button"
												class="btn btn-ghost btn-sm btn-icon"
												aria-label="Edit {asText(row[titleKey]) || noun}"
												title="Edit"
												onclick={() => {
													editing = row;
													editOpen = true;
												}}
											>
												<Pencil size={17} />
											</button>
											{#if canDelete}
												<button
													type="button"
													class="btn btn-ghost btn-sm btn-icon hover:text-bad"
													aria-label="Delete {asText(row[titleKey]) || noun}"
													title="Delete"
													onclick={() => {
														deleting = row;
														deleteOpen = true;
													}}
												>
													<Trash size={17} />
												</button>
											{/if}
										{/if}
									</div>
								</td>
							{/if}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</section>

{#if editable && fields}
	{#key editing?.id ?? 'new'}
		<RecordDialog
			bind:open={editOpen}
			{noun}
			{fields}
			record={editing}
			{createAction}
			{updateAction}
			size={dialogSize}
		/>
	{/key}
	<ConfirmDialog
		bind:open={deleteOpen}
		title="Delete this {noun}?"
		message={`“${asText(deleting?.[titleKey]) || noun}” will be permanently deleted.`}
		action={deleteAction}
		values={{ id: deleting?.id ?? '' }}
	/>
{/if}

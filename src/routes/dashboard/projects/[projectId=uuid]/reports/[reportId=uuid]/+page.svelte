<script lang="ts">
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Copy from '@lucide/svelte/icons/copy';
	import Pencil from '@lucide/svelte/icons/pencil';
	import Trash from '@lucide/svelte/icons/trash';
	import ConfirmDialog from '#lib/components/ConfirmDialog.svelte';
	import RecordDialog from '#lib/components/RecordDialog.svelte';
	import Time from '#lib/components/Time.svelte';
	import { formatNumber } from '#lib/format.ts';
	import { reportFields } from '#lib/sections.ts';
	import { toasts } from '#lib/toast.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const report = $derived(data.report);
	const fields = $derived(reportFields(data.folders));
	const words = $derived((report.content ?? '').trim().split(/\s+/).filter(Boolean).length);

	let editing = $state(false);
	let deleting = $state(false);

	async function copy() {
		try {
			await navigator.clipboard.writeText(report.content);
			toasts.show('Report text copied.');
		} catch {
			toasts.show('Could not copy. Select the text and copy it by hand.', 'bad');
		}
	}
</script>

<svelte:head>
	<title>{report.title} · {data.project.name}</title>
</svelte:head>

<a href="/dashboard/projects/{data.project.id}/reports" class="btn btn-ghost btn-sm mb-5 -ml-2 text-muted">
	<ArrowLeft size={17} /> All reports
</a>

<header class="mb-8 flex flex-wrap items-start justify-between gap-5">
	<div class="min-w-0 flex-1">
		<h1 class="text-3xl wrap-break-word sm:text-4xl">{report.title}</h1>
		<p class="mt-3 flex flex-wrap gap-x-2 gap-y-1 text-muted">
			<span>{report.created_by || 'Unknown author'}</span>
			<span aria-hidden="true">·</span>
			<span>Updated <Time value={report.updated_at} relative /></span>
			{#if data.folderName}
				<span aria-hidden="true">·</span><span>In “{data.folderName}”</span>
			{/if}
			<span aria-hidden="true">·</span>
			<span>{formatNumber(words)} words</span>
		</p>
	</div>
	<div class="flex gap-3">
		<button type="button" class="btn" onclick={copy}><Copy size={18} /> Copy text</button>
		{#if data.canEdit}
			<button type="button" class="btn" onclick={() => (editing = true)}><Pencil size={18} /> Edit</button>
			<button type="button" class="btn btn-danger btn-icon" aria-label="Delete report" title="Delete" onclick={() => (deleting = true)}>
				<Trash size={18} />
			</button>
		{/if}
	</div>
</header>

<article class="panel p-6 sm:p-10">
	<div class="markdown mx-auto max-w-[52rem]">
		<!-- Safe: the HTML was produced and sanitised on the server (lib/server/markdown.ts). -->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html data.html}
	</div>
</article>

{#if data.canEdit}
	<RecordDialog bind:open={editing} noun="report" {fields} record={report} size="lg" />
	<ConfirmDialog
		bind:open={deleting}
		title="Delete this report?"
		message={`“${report.title}” will be permanently deleted.`}
		values={{ id: report.id }}
	/>
{/if}
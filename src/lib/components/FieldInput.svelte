<script lang="ts">
	import type { Field, FieldValue } from '#lib/fields.ts';

	interface Props {
		field: Field;
		value?: FieldValue;
		error?: string;
	}

	let { field, value, error }: Props = $props();

	const uid = $props.id();
	const id = $derived(`${uid}-${field.name}`);
	const describedBy = $derived(
		[error ? `${id}-error` : '', field.hint ? `${id}-hint` : ''].filter(Boolean).join(' ') ||
			undefined
	);
	const textValue = $derived(
		Array.isArray(value) ? value.join(', ') : value === null || value === undefined ? '' : String(value)
	);
</script>

<div class={field.wide || field.type === 'textarea' ? 'sm:col-span-2' : ''}>
	{#if field.type === 'checkbox'}
		<label class="choice" for={id}>
			<input
				{id}
				type="checkbox"
				name={field.name}
				class="checkbox"
				checked={value === true}
				aria-describedby={describedBy}
			/>
			{field.label}
		</label>
	{:else}
		<label class="label" for={id}>
			{field.label}
			{#if !field.required && field.type !== 'select'}
				<span class="font-normal text-muted">(optional)</span>
			{/if}
		</label>

		{#if field.type === 'textarea'}
			<textarea
				{id}
				name={field.name}
				class="textarea"
				rows={field.rows ?? 4}
				required={field.required}
				maxlength={field.max ?? 20000}
				placeholder={field.placeholder}
				aria-invalid={error ? 'true' : undefined}
				aria-describedby={describedBy}>{textValue}</textarea
			>
		{:else if field.type === 'select'}
			<select
				{id}
				name={field.name}
				class="select"
				required={field.required}
				aria-invalid={error ? 'true' : undefined}
				aria-describedby={describedBy}
			>
				{#if !field.required && !field.options?.some((option) => option.value === '')}
					<option value="" selected={textValue === ''}>None</option>
				{/if}
				{#each field.options ?? [] as option (option.value)}
					<option value={option.value} selected={option.value === textValue}>{option.label}</option>
				{/each}
			</select>
		{:else}
			<input
				{id}
				name={field.name}
				class="input"
				type={field.type === 'date'
					? 'date'
					: field.type === 'number' || field.type === 'money'
						? 'number'
						: field.type === 'url'
							? 'url'
							: 'text'}
				value={textValue}
				required={field.required}
				maxlength={field.type === 'text' ? (field.max ?? 200) : undefined}
				min={field.type === 'money' ? (field.min ?? 0) : field.min}
				max={field.type === 'number' || field.type === 'money' ? field.max : undefined}
				step={field.type === 'money' ? '0.01' : field.type === 'number' ? '1' : undefined}
				inputmode={field.type === 'money' ? 'decimal' : undefined}
				placeholder={field.placeholder}
				autocomplete="off"
				aria-invalid={error ? 'true' : undefined}
				aria-describedby={describedBy}
			/>
		{/if}
	{/if}

	{#if field.hint}
		<p class="hint" id="{id}-hint">{field.hint}</p>
	{/if}
	{#if error}
		<p class="field-error" id="{id}-error">{error}</p>
	{/if}
</div>

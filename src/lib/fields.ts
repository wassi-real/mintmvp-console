// Field definitions shared by the form UI (FieldInput.svelte) and server-side validation
// (lib/server/validate.ts), so a form and its validation cannot drift apart.

import type { Option } from './constants';

export type FieldType =
	| 'text'
	| 'textarea'
	| 'select'
	| 'date'
	| 'number'
	| 'money'
	| 'url'
	| 'checkbox'
	| 'tags';

export interface Field {
	name: string;
	label: string;
	type: FieldType;
	required?: boolean;
	/** Maximum length for text, maximum value for numbers. */
	max?: number;
	min?: number;
	options?: readonly Option[];
	placeholder?: string;
	hint?: string;
	rows?: number;
	/** Store NULL instead of an empty string when left blank. */
	nullable?: boolean;
	/** Value used when creating a new record. */
	initial?: string | number | boolean;
	/** Span both columns in a two-column form. */
	wide?: boolean;
}

export type FieldValue = string | number | boolean | string[] | null;
export type FieldValues = Record<string, FieldValue>;

export function fieldDefaults(fields: readonly Field[]): FieldValues {
	const values: FieldValues = {};
	for (const field of fields) {
		if (field.initial !== undefined) values[field.name] = field.initial;
		else if (field.type === 'checkbox') values[field.name] = false;
		else if (field.type === 'tags') values[field.name] = [];
		else values[field.name] = '';
	}
	return values;
}

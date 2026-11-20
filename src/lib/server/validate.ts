import type { Field, FieldValues } from '#lib/fields.ts';

export type Validation =
	| { ok: true; values: FieldValues }
	| { ok: false; errors: Record<string, string>; message: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function text(form: FormData, name: string): string {
	const value = form.get(name);
	return typeof value === 'string' ? value.trim() : '';
}

export function isValidDate(value: string): boolean {
	if (!DATE.test(value)) return false;
	const date = new Date(`${value}T00:00:00Z`);
	return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isHttpUrl(value: string): boolean {
	try {
		const url = new URL(value);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}

export function isUuid(value: string): boolean {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function isEmail(value: string): boolean {
	return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Validates submitted form data against field definitions. Only listed fields are returned. */
export function validate(fields: readonly Field[], form: FormData): Validation {
	const values: FieldValues = {};
	const errors: Record<string, string> = {};

	for (const field of fields) {
		const raw = text(form, field.name);
		const empty = field.nullable ? null : '';

		switch (field.type) {
			case 'text':
			case 'textarea': {
				const max = field.max ?? (field.type === 'text' ? 200 : 20000);
				if (!raw && field.required) errors[field.name] = `${field.label} is required.`;
				else if (raw.length > max) {
					errors[field.name] = `${field.label} must be ${max} characters or fewer.`;
				}
				values[field.name] = raw || empty;
				break;
			}
			case 'select': {
				const allowed = field.options?.some((option) => option.value === raw) ?? false;
				if (!raw && field.required) errors[field.name] = `Choose a value for ${field.label}.`;
				else if (!allowed && (raw || !field.nullable)) {
					errors[field.name] = `Choose a value from the list for ${field.label}.`;
				}
				values[field.name] = raw || empty;
				break;
			}
			case 'date': {
				if (!raw) {
					if (field.required) errors[field.name] = `${field.label} is required.`;
					values[field.name] = null;
				} else if (!isValidDate(raw)) {
					errors[field.name] = `${field.label} must be a valid date.`;
				} else {
					values[field.name] = raw;
				}
				break;
			}
			case 'number':
			case 'money': {
				if (!raw) {
					if (field.required) errors[field.name] = `${field.label} is required.`;
					values[field.name] = field.nullable ? null : 0;
					break;
				}
				const number = Number(raw);
				const min = field.min ?? (field.type === 'money' ? 0 : -1_000_000_000);
				const max = field.max ?? 1_000_000_000;
				if (!Number.isFinite(number)) errors[field.name] = `${field.label} must be a number.`;
				else if (number < min) errors[field.name] = `${field.label} must be at least ${min}.`;
				else if (number > max) errors[field.name] = `${field.label} must be at most ${max}.`;
				else if (field.type === 'number' && !Number.isInteger(number)) {
					errors[field.name] = `${field.label} must be a whole number.`;
				}
				values[field.name] = field.type === 'money' ? Math.round(number * 100) / 100 : number;
				break;
			}
			case 'url': {
				if (!raw) {
					if (field.required) errors[field.name] = `${field.label} is required.`;
				} else if (raw.length > 2000 || !isHttpUrl(raw)) {
					errors[field.name] = `${field.label} must be a web address starting with http:// or https://.`;
				}
				values[field.name] = raw || empty;
				break;
			}
			case 'checkbox': {
				values[field.name] = raw === 'on' || raw === 'true';
				break;
			}
			case 'tags': {
				const tags = [
					...new Set(
						raw
							.split(',')
							.map((tag) => tag.trim())
							.filter(Boolean)
					)
				];
				if (tags.length > 10) errors[field.name] = `Use at most 10 values for ${field.label}.`;
				else if (tags.some((tag) => tag.length > 30)) {
					errors[field.name] = `Each value in ${field.label} must be 30 characters or fewer.`;
				}
				values[field.name] = tags;
				break;
			}
		}
	}

	if (Object.keys(errors).length > 0) {
		return { ok: false, errors, message: 'Please fix the highlighted fields.' };
	}
	return { ok: true, values };
}

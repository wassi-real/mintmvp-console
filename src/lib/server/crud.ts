import { fail, type RequestEvent } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TableName } from '#lib/database.types.ts';
import type { Field, FieldValues } from '#lib/fields.ts';
import { logActivity } from './activity.ts';
import { projectContext, type ProjectContext } from './context.ts';
import { isUuid, text, validate } from './validate.ts';

export const VIEW_ONLY = 'You have view-only access to this workspace, so you cannot change this.';

export function dbMessage(error: { code?: string; message: string }, noun: string): string {
	if (error.code === '23505') return `That ${noun} already exists.`;
	if (error.code === '23503') return `That ${noun} refers to something that no longer exists.`;
	if (error.code === '23514') return `One of the values is not allowed for a ${noun}.`;
	if (error.code === '42501') return VIEW_ONLY;
	console.error(`database error (${noun}):`, error.code, error.message);
	return `Could not save the ${noun}. Please try again.`;
}

type FieldSource = readonly Field[] | ((context: ProjectContext) => Promise<readonly Field[]>);

interface CrudOptions {
	/** A table with a project_id column. */
	table: TableName;
	/** Field definitions, or a function when the choices depend on the project. */
	fields: FieldSource;
	/** Lower-case singular name used in messages, for example "incident". */
	noun: string;
	/** Column shown in the activity history, for example "title". */
	titleField: string;
	/** Adjust or add values before a row is created or changed. Return a string to reject. */
	prepare?: (
		values: FieldValues,
		context: ProjectContext,
		mode: 'create' | 'update',
		form: FormData
	) => FieldValues | string | Promise<FieldValues | string>;
	/** Runs after a successful create or update. */
	after?: (
		row: Record<string, unknown>,
		context: ProjectContext,
		mode: 'create' | 'update'
	) => void | Promise<void>;
}

/** The user-scoped client without table typing, for tables chosen at run time. */
export function untyped(context: { supabase: unknown }): SupabaseClient {
	return context.supabase as SupabaseClient;
}

/**
 * Create / update / delete form actions for a project-scoped table. Every query is limited to the
 * project in the URL, and the database's row level security is the final authority.
 */
export function crudActions(options: CrudOptions) {
	const { table, noun, titleField } = options;
	const label = noun.charAt(0).toUpperCase() + noun.slice(1);
	const key = noun.replace(/\s+/g, '_');

	// Table and column names come from this file's callers, never from user input.
	const from = (context: ProjectContext) => untyped(context).from(table);
	const fieldsFor = async (context: ProjectContext) =>
		typeof options.fields === 'function' ? options.fields(context) : options.fields;

	return {
		create: async (event: RequestEvent) => {
			const context = await projectContext(event);
			if (!context.canEdit) return fail(403, { message: VIEW_ONLY });

			const form = await event.request.formData();
			const result = validate(await fieldsFor(context), form);
			if (!result.ok) return fail(400, result);

			const values = options.prepare
				? await options.prepare(result.values, context, 'create', form)
				: result.values;
			if (typeof values === 'string') return fail(400, { message: values });

			const { data, error } = await from(context)
				.insert({ ...values, project_id: context.project.id })
				.select('*')
				.single();
			if (error) return fail(400, { message: dbMessage(error, noun) });

			await logActivity(context, `${label} created: ${String(data[titleField] ?? '')}`, {
				[key]: data.id
			});
			await options.after?.(data, context, 'create');
			return { message: `${label} created.`, id: data.id as string };
		},

		update: async (event: RequestEvent) => {
			const context = await projectContext(event);
			if (!context.canEdit) return fail(403, { message: VIEW_ONLY });

			const form = await event.request.formData();
			const id = text(form, 'id');
			if (!isUuid(id)) return fail(400, { message: `That ${noun} could not be found.` });

			const result = validate(await fieldsFor(context), form);
			if (!result.ok) return fail(400, result);

			const values = options.prepare
				? await options.prepare(result.values, context, 'update', form)
				: result.values;
			if (typeof values === 'string') return fail(400, { message: values });

			const { data, error } = await from(context)
				.update(values)
				.eq('id', id)
				.eq('project_id', context.project.id)
				.select('*')
				.maybeSingle();
			if (error) return fail(400, { message: dbMessage(error, noun) });
			if (!data) return fail(404, { message: `That ${noun} could not be found.` });

			await logActivity(context, `${label} updated: ${String(data[titleField] ?? '')}`, {
				[key]: id
			});
			await options.after?.(data, context, 'update');
			return { message: `${label} saved.`, id };
		},

		delete: async (event: RequestEvent) => {
			const context = await projectContext(event);
			if (!context.canEdit) return fail(403, { message: VIEW_ONLY });

			const id = text(await event.request.formData(), 'id');
			if (!isUuid(id)) return fail(400, { message: `That ${noun} could not be found.` });

			const { data, error } = await from(context)
				.delete()
				.eq('id', id)
				.eq('project_id', context.project.id)
				.select('*')
				.maybeSingle();
			if (error) return fail(400, { message: dbMessage(error, noun) });
			if (!data) return fail(404, { message: `That ${noun} could not be found.` });

			await logActivity(context, `${label} deleted: ${String(data[titleField] ?? '')}`);
			return { message: `${label} deleted.` };
		}
	};
}

/** Renames create / update / delete so several record types can share one page. */
export function named<Name extends string>(name: Name, actions: ReturnType<typeof crudActions>) {
	return {
		[`create${name}`]: actions.create,
		[`update${name}`]: actions.update,
		[`delete${name}`]: actions.delete
	} as Record<`create${Name}` | `update${Name}` | `delete${Name}`, (typeof actions)['create']>;
}

/** The stored row a form refers to (by its hidden "id" input), limited to the current project. */
export async function existingRow(
	context: ProjectContext,
	table: TableName,
	form: FormData
): Promise<Record<string, unknown> | null> {
	const id = text(form, 'id');
	if (!isUuid(id)) return null;
	const { data } = await untyped(context)
		.from(table)
		.select('*')
		.eq('id', id)
		.eq('project_id', context.project.id)
		.maybeSingle();
	return data;
}
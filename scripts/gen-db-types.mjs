// Generates src/lib/database.types.ts from the cloud Supabase project's REST schema.
// Read-only: it performs a single GET against the project's OpenAPI description.
//
//   node scripts/gen-db-types.mjs
//
// PENDING holds the tables, columns and functions added by the two 20261120 migrations. Entries
// the live schema already has are skipped, so the script gives the same result before and after
// those migrations are applied.

import { readFileSync, writeFileSync } from 'node:fs';

const env = Object.fromEntries(
	readFileSync('.env', 'utf8')
		.split(/\r?\n/)
		.map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/))
		.filter(Boolean)
		.map((m) => [m[1], m[2].trim().replace(/^['"]|['"]$/g, '')])
);

const base = env.PUBLIC_SUPABASE_URL?.replace(/\/+$/, '');
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key) {
	console.error('PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
	process.exit(1);
}

const response = await fetch(`${base}/rest/v1/`, {
	headers: { apikey: key, Authorization: `Bearer ${key}` }
});
if (!response.ok) {
	console.error(`Could not read the schema: HTTP ${response.status}`);
	process.exit(1);
}
const spec = await response.json();

/** @typedef {{ type: string, nullable: boolean, hasDefault: boolean, fk?: string }} Column */

const col = (type, { nullable = false, hasDefault = false, fk } = {}) => ({
	type,
	nullable,
	hasDefault,
	fk
});

/** @type {Record<string, Record<string, Column>>} */
const PENDING = {
	users: {
		username: col('string', { nullable: true }),
		avatar_url: col('string', { nullable: true }),
		bio: col('string', { hasDefault: true }),
		onboarded_at: col('string', { nullable: true }),
		updated_at: col('string', { hasDefault: true })
	},
	user_onboarding: {
		user_id: col('string', { fk: 'users' }),
		persona: col('string'),
		use_cases: col('string[]', { hasDefault: true }),
		referral_source: col('string'),
		referral_detail: col('string', { hasDefault: true }),
		completed_at: col('string', { hasDefault: true })
	},
	organization_members: {
		organization_id: col('string', { fk: 'organizations' }),
		user_id: col('string', { fk: 'users' }),
		role: col('string', { hasDefault: true }),
		created_at: col('string', { hasDefault: true })
	},
	workspace_invites: {
		id: col('string', { hasDefault: true }),
		organization_id: col('string', { fk: 'organizations' }),
		email: col('string'),
		role: col('string', { hasDefault: true }),
		invited_by: col('string', { nullable: true, fk: 'users' }),
		created_at: col('string', { hasDefault: true }),
		expires_at: col('string', { hasDefault: true }),
		accepted_at: col('string', { nullable: true }),
		revoked_at: col('string', { nullable: true })
	},
	projects: {
		description: col('string', { hasDefault: true }),
		priority: col('string', { hasDefault: true }),
		target_date: col('string', { nullable: true }),
		updated_at: col('string', { hasDefault: true })
	},
	tasks: {
		parent_task_id: col('string', { nullable: true, fk: 'tasks' }),
		assignee_user_id: col('string', { nullable: true, fk: 'users' }),
		created_by: col('string', { nullable: true, fk: 'users' }),
		due_date: col('string', { nullable: true }),
		labels: col('string[]', { hasDefault: true }),
		sort_order: col('number', { hasDefault: true }),
		updated_at: col('string', { hasDefault: true })
	},
	task_dependencies: {
		task_id: col('string', { fk: 'tasks' }),
		depends_on_task_id: col('string', { fk: 'tasks' }),
		created_at: col('string', { hasDefault: true })
	},
	task_comments: {
		id: col('string', { hasDefault: true }),
		task_id: col('string', { fk: 'tasks' }),
		author_user_id: col('string', { nullable: true, fk: 'users' }),
		author_name: col('string', { hasDefault: true }),
		body: col('string'),
		created_at: col('string', { hasDefault: true })
	},
	notifications: {
		id: col('string', { hasDefault: true }),
		user_id: col('string', { fk: 'users' }),
		organization_id: col('string', { fk: 'organizations' }),
		project_id: col('string', { nullable: true, fk: 'projects' }),
		kind: col('string'),
		title: col('string'),
		body: col('string', { hasDefault: true }),
		link: col('string', { hasDefault: true }),
		created_by: col('string', { nullable: true, fk: 'users' }),
		created_at: col('string', { hasDefault: true }),
		read_at: col('string', { nullable: true })
	}
};

const PENDING_FUNCTIONS = {
	accept_invite: { args: '{ p_invite_id: string }', returns: 'string' },
	create_workspace: { args: '{ p_name: string }', returns: 'string' },
	current_org_id: { args: 'never', returns: 'string' },
	current_org_role: { args: 'never', returns: 'string' },
	is_org_staff: { args: 'never', returns: 'boolean' },
	my_pending_invites: {
		args: 'never',
		returns:
			'{ id: string; organization_id: string; organization_name: string; role: string; invited_by_name: string; created_at: string; expires_at: string }[]'
	},
	remove_member: { args: '{ p_user_id: string }', returns: 'undefined' },
	set_member_role: { args: '{ p_user_id: string; p_role: string }', returns: 'undefined' },
	switch_workspace: { args: '{ p_organization_id: string }', returns: 'undefined' },
	username_available: { args: '{ p_username: string }', returns: 'boolean' }
};

function tsType(property) {
	const format = property.format ?? '';
	if (property.type === 'array' || format.endsWith('[]')) {
		const inner = /^(text|uuid|character varying)/.test(format) ? 'string' : 'unknown';
		return `${inner}[]`;
	}
	// PostgREST reports int64 (bigint) values as strings, because they can exceed JS safe integers.
	if (property.type === 'integer' && format === 'int64') return 'string';
	if (property.type === 'integer' || property.type === 'number') return 'number';
	if (/^(integer|bigint|smallint|numeric|double precision|real|int\d)/.test(format)) return 'number';
	if (format === 'boolean') return 'boolean';
	if (format === 'jsonb' || format === 'json') return 'Json';
	return 'string';
}

/** @type {Record<string, Record<string, Column>>} */
const tables = {};

for (const [name, definition] of Object.entries(spec.definitions ?? {})) {
	const required = new Set(definition.required ?? []);
	tables[name] = {};
	for (const [column, property] of Object.entries(definition.properties ?? {})) {
		const fk = /Foreign Key to `([^.`]+)\./.exec(property.description ?? '')?.[1];
		tables[name][column] = {
			type: tsType(property),
			nullable: !required.has(column),
			hasDefault: property.default !== undefined,
			fk
		};
	}
}

let pendingCount = 0;
for (const [name, columns] of Object.entries(PENDING)) {
	tables[name] ??= {};
	for (const [column, definition] of Object.entries(columns)) {
		if (tables[name][column]) {
			// The REST schema does not report defaults for every column type (arrays, for example).
			if (definition.hasDefault) tables[name][column].hasDefault = true;
			continue;
		}
		tables[name][column] = definition;
		pendingCount++;
	}
}

const liveFunctions = Object.keys(spec.paths ?? {})
	.filter((path) => path.startsWith('/rpc/'))
	.map((path) => path.slice(5));

const out = [];
out.push('// Generated by scripts/gen-db-types.mjs. Do not edit by hand.');
out.push('');
out.push('export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];');
out.push('');
out.push('export type Database = {');
out.push('\tpublic: {');
out.push('\t\tTables: {');

for (const name of Object.keys(tables).sort()) {
	const columns = tables[name];
	const names = Object.keys(columns).sort();
	const rowType = (c) => `${c.type}${c.nullable ? ' | null' : ''}`;

	out.push(`\t\t\t${name}: {`);
	out.push('\t\t\t\tRow: {');
	for (const column of names) out.push(`\t\t\t\t\t${column}: ${rowType(columns[column])};`);
	out.push('\t\t\t\t};');
	out.push('\t\t\t\tInsert: {');
	for (const column of names) {
		const c = columns[column];
		const optional = c.nullable || c.hasDefault;
		out.push(`\t\t\t\t\t${column}${optional ? '?' : ''}: ${rowType(c)};`);
	}
	out.push('\t\t\t\t};');
	out.push('\t\t\t\tUpdate: {');
	for (const column of names) out.push(`\t\t\t\t\t${column}?: ${rowType(columns[column])};`);
	out.push('\t\t\t\t};');
	out.push('\t\t\t\tRelationships: [');
	for (const column of names) {
		const c = columns[column];
		if (!c.fk) continue;
		out.push('\t\t\t\t\t{');
		out.push(`\t\t\t\t\t\tforeignKeyName: '${name}_${column}_fkey';`);
		out.push(`\t\t\t\t\t\tcolumns: ['${column}'];`);
		out.push('\t\t\t\t\t\tisOneToOne: false;');
		out.push(`\t\t\t\t\t\treferencedRelation: '${c.fk}';`);
		out.push(`\t\t\t\t\t\treferencedColumns: ['id'];`);
		out.push('\t\t\t\t\t},');
	}
	out.push('\t\t\t\t];');
	out.push('\t\t\t};');
}

out.push('\t\t};');
out.push('\t\tViews: { [_ in never]: never };');
out.push('\t\tFunctions: {');
for (const [name, fn] of Object.entries(PENDING_FUNCTIONS).sort(([a], [b]) => a.localeCompare(b))) {
	out.push(`\t\t\t${name}: {`);
	out.push(`\t\t\t\tArgs: ${fn.args};`);
	out.push(`\t\t\t\tReturns: ${fn.returns};`);
	out.push('\t\t\t};');
}
out.push('\t\t};');
out.push('\t\tEnums: { [_ in never]: never };');
out.push('\t\tCompositeTypes: { [_ in never]: never };');
out.push('\t};');
out.push('};');
out.push('');
out.push("type PublicSchema = Database['public'];");
out.push('');
out.push("export type TableName = keyof PublicSchema['Tables'];");
out.push("export type Row<T extends TableName> = PublicSchema['Tables'][T]['Row'];");
out.push("export type InsertRow<T extends TableName> = PublicSchema['Tables'][T]['Insert'];");
out.push("export type UpdateRow<T extends TableName> = PublicSchema['Tables'][T]['Update'];");
out.push('');

writeFileSync('src/lib/database.types.ts', out.join('\n'));

const missingFunctions = Object.keys(PENDING_FUNCTIONS).filter((fn) => !liveFunctions.includes(fn));
console.log(`Wrote src/lib/database.types.ts with ${Object.keys(tables).length} tables.`);
console.log(
	pendingCount || missingFunctions.length
		? `Not in the cloud database yet (waiting on the 20261120 migrations): ${pendingCount} columns, ${missingFunctions.length} functions.`
		: 'The cloud database already has everything from the 20261120 migrations.'
);

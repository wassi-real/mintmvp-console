import { ANTHROPIC_API_KEY } from '$app/env/private';
import { createAnthropic } from '@ai-sdk/anthropic';
import { isStepCount, tool, ToolLoopAgent, type ModelMessage } from 'ai';
import { z } from 'zod';
import {
	INCIDENT_SEVERITIES,
	INCIDENT_STATUSES,
	MILESTONE_PHASES,
	MILESTONE_PRIORITIES,
	PRIORITIES,
	SPEC_STATUSES,
	TASK_STATUSES
} from '#lib/constants.ts';
import { logActivity } from './activity.ts';
import { displayName, type ProjectContext } from './context.ts';
import { untyped } from './crud.ts';

const values = (options: readonly { value: string }[]) => options.map((option) => option.value);

function denied(context: ProjectContext): string | null {
	return context.canEdit
		? null
		: 'This person has view-only access, so nothing can be changed. Offer to explain the project instead.';
}

function clip(value: unknown, max = 4000): string {
	const text = typeof value === 'string' ? value : '';
	return text.length > max ? `${text.slice(0, max)}…` : text;
}

async function rows(
	context: ProjectContext,
	table: string,
	columns: string,
	limit = 40
): Promise<{ items: Record<string, unknown>[] } | { error: string }> {
	const { data, error } = await untyped(context)
		.from(table)
		.select(columns)
		.eq('project_id', context.project.id)
		.limit(limit);
	if (error) return { error: error.message };
	return { items: (data ?? []) as unknown as Record<string, unknown>[] };
}

async function change(
	context: ProjectContext,
	table: string,
	id: string,
	patch: Record<string, unknown>,
	label: string
): Promise<{ ok: true } | { error: string }> {
	const blocked = denied(context);
	if (blocked) return { error: blocked };
	const { data, error } = await untyped(context)
		.from(table)
		.update(patch)
		.eq('id', id)
		.eq('project_id', context.project.id)
		.select('id')
		.maybeSingle();
	if (error) return { error: error.message };
	if (!data) return { error: `That ${label} is not in this project.` };
	await logActivity(context, `MintAI updated a ${label}`, { [label]: id });
	return { ok: true };
}

async function remove(
	context: ProjectContext,
	table: string,
	id: string,
	label: string
): Promise<{ ok: true } | { error: string }> {
	const blocked = denied(context);
	if (blocked) return { error: blocked };
	const { data, error } = await untyped(context)
		.from(table)
		.delete()
		.eq('id', id)
		.eq('project_id', context.project.id)
		.select('id')
		.maybeSingle();
	if (error) return { error: error.message };
	if (!data) return { error: `That ${label} is not in this project.` };
	await logActivity(context, `MintAI deleted a ${label}`, { [label]: id });
	return { ok: true };
}

async function add(
	context: ProjectContext,
	table: string,
	values: Record<string, unknown>,
	label: string
): Promise<{ id: string } | { error: string }> {
	const blocked = denied(context);
	if (blocked) return { error: blocked };
	const { data, error } = await untyped(context)
		.from(table)
		.insert({ ...values, project_id: context.project.id })
		.select('id')
		.single();
	if (error) return { error: error.message };
	await logActivity(context, `MintAI created a ${label}`, { [label]: data.id });
	return { id: String(data.id) };
}

/** Tools that can read and change only the project the person currently has open. */
export function mintTools(context: ProjectContext) {
	const id = z.string().uuid();
	return {
		project_overview: tool({
			description: 'Read the project name, description, status and a count of its main records.',
			inputSchema: z.object({}),
			execute: async () => {
				const supabase = untyped(context);
				const id = context.project.id;
				const [tasks, milestones, specs, reports, incidents] = await Promise.all([
					supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('project_id', id),
					supabase.from('milestones').select('id', { count: 'exact', head: true }).eq('project_id', id),
					supabase.from('specs').select('id', { count: 'exact', head: true }).eq('project_id', id),
					supabase.from('reports').select('id', { count: 'exact', head: true }).eq('project_id', id),
					supabase
						.from('incidents')
						.select('id', { count: 'exact', head: true })
						.eq('project_id', id)
						.neq('status', 'resolved')
				]);
				return {
					name: context.project.name,
					description: context.project.description,
					status: context.project.status,
					tasks: tasks.count ?? 0,
					milestones: milestones.count ?? 0,
					specs: specs.count ?? 0,
					reports: reports.count ?? 0,
					openIncidents: incidents.count ?? 0,
					canEdit: context.canEdit
				};
			}
		}),

		list_tasks: tool({
			description: 'List tasks in this project. Optional status filter.',
			inputSchema: z.object({ status: z.enum(values(TASK_STATUSES) as [string, ...string[]]).optional() }),
			execute: async ({ status }) => {
				let query = untyped(context)
					.from('tasks')
					.select('id, title, status, priority, due_date, assignee, parent_task_id')
					.eq('project_id', context.project.id)
					.order('created_at', { ascending: false })
					.limit(40);
				if (status) query = query.eq('status', status);
				const { data, error } = await query;
				return error ? { error: error.message } : { items: data };
			}
		}),
		create_task: tool({
			description: 'Create a task in this project.',
			inputSchema: z.object({
				title: z.string().min(1).max(200),
				description: z.string().max(4000).optional(),
				status: z.enum(values(TASK_STATUSES) as [string, ...string[]]).optional(),
				priority: z.enum(values(PRIORITIES) as [string, ...string[]]).optional(),
				due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
			}),
			execute: async (input) =>
				add(context, 'tasks', { ...input, created_by: context.profile.id }, 'task')
		}),
		update_task: tool({
			description: 'Change a task that belongs to this project.',
			inputSchema: z.object({
				id,
				title: z.string().min(1).max(200).optional(),
				description: z.string().max(4000).optional(),
				status: z.enum(values(TASK_STATUSES) as [string, ...string[]]).optional(),
				priority: z.enum(values(PRIORITIES) as [string, ...string[]]).optional(),
				due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()
			}),
			execute: async ({ id: taskId, ...patch }) => change(context, 'tasks', taskId, patch, 'task')
		}),
		delete_task: tool({
			description: 'Permanently delete a task in this project. Only when the user asked to delete it.',
			inputSchema: z.object({ id }),
			execute: async ({ id: taskId }) => remove(context, 'tasks', taskId, 'task')
		}),

		list_specs: tool({
			description: 'List specs in this project.',
			inputSchema: z.object({}),
			execute: async () => rows(context, 'specs', 'id, title, status, summary')
		}),
		read_spec: tool({
			description: 'Read one spec, including its goal and acceptance criteria.',
			inputSchema: z.object({ id }),
			execute: async ({ id: specId }) => {
				const { data, error } = await untyped(context)
					.from('specs')
					.select('id, title, status, summary, goal, acceptance_criteria, edge_cases, regression_risks')
					.eq('id', specId)
					.eq('project_id', context.project.id)
					.maybeSingle();
				if (error) return { error: error.message };
				if (!data) return { error: 'That spec is not in this project.' };
				return data;
			}
		}),
		create_spec: tool({
			description: 'Create a spec in this project.',
			inputSchema: z.object({
				title: z.string().min(1).max(200),
				summary: z.string().max(4000).optional(),
				goal: z.string().max(4000).optional(),
				acceptance_criteria: z.string().max(4000).optional(),
				status: z.enum(values(SPEC_STATUSES) as [string, ...string[]]).optional()
			}),
			execute: async (input) => add(context, 'specs', input, 'spec')
		}),
		update_spec: tool({
			description: 'Change a spec in this project.',
			inputSchema: z.object({
				id,
				title: z.string().min(1).max(200).optional(),
				summary: z.string().max(4000).optional(),
				goal: z.string().max(4000).optional(),
				acceptance_criteria: z.string().max(4000).optional(),
				status: z.enum(values(SPEC_STATUSES) as [string, ...string[]]).optional()
			}),
			execute: async ({ id: specId, ...patch }) => change(context, 'specs', specId, patch, 'spec')
		}),
		delete_spec: tool({
			description: 'Permanently delete a spec. Only when the user asked to delete it.',
			inputSchema: z.object({ id }),
			execute: async ({ id: specId }) => remove(context, 'specs', specId, 'spec')
		}),

		list_reports: tool({
			description: 'List report titles in this project. Does not return the full text.',
			inputSchema: z.object({}),
			execute: async () => rows(context, 'reports', 'id, title, created_by, updated_at')
		}),
		read_report: tool({
			description: 'Read one report. Long reports are shortened.',
			inputSchema: z.object({ id }),
			execute: async ({ id: reportId }) => {
				const { data, error } = await untyped(context)
					.from('reports')
					.select('id, title, content')
					.eq('id', reportId)
					.eq('project_id', context.project.id)
					.maybeSingle();
				if (error) return { error: error.message };
				if (!data) return { error: 'That report is not in this project.' };
				return { id: data.id, title: data.title, content: clip(data.content, 8000) };
			}
		}),
		create_report: tool({
			description: 'Create a Markdown report in this project.',
			inputSchema: z.object({
				title: z.string().min(1).max(300),
				content: z.string().min(1).max(20000)
			}),
			execute: async (input) =>
				add(
					context,
					'reports',
					{ ...input, created_by: displayName(context.profile) },
					'report'
				)
		}),
		update_report: tool({
			description: 'Change a report title or its Markdown content.',
			inputSchema: z.object({
				id,
				title: z.string().min(1).max(300).optional(),
				content: z.string().min(1).max(20000).optional()
			}),
			execute: async ({ id: reportId, ...patch }) =>
				change(context, 'reports', reportId, patch, 'report')
		}),
		delete_report: tool({
			description: 'Permanently delete a report. Only when the user asked to delete it.',
			inputSchema: z.object({ id }),
			execute: async ({ id: reportId }) => remove(context, 'reports', reportId, 'report')
		}),

		list_milestones: tool({
			description: 'List milestones in this project.',
			inputSchema: z.object({}),
			execute: async () => rows(context, 'milestones', 'id, title, phase, priority, due_date, status')
		}),
		create_milestone: tool({
			description: 'Create a milestone in this project.',
			inputSchema: z.object({
				title: z.string().min(1).max(200),
				description: z.string().max(4000).optional(),
				phase: z.enum(values(MILESTONE_PHASES) as [string, ...string[]]).optional(),
				priority: z.enum(values(MILESTONE_PRIORITIES) as [string, ...string[]]).optional(),
				due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
			}),
			execute: async (input) => add(context, 'milestones', input, 'milestone')
		}),
		update_milestone: tool({
			description: 'Change a milestone in this project.',
			inputSchema: z.object({
				id,
				title: z.string().min(1).max(200).optional(),
				description: z.string().max(4000).optional(),
				phase: z.enum(values(MILESTONE_PHASES) as [string, ...string[]]).optional(),
				priority: z.enum(values(MILESTONE_PRIORITIES) as [string, ...string[]]).optional(),
				due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()
			}),
			execute: async ({ id: milestoneId, ...patch }) =>
				change(context, 'milestones', milestoneId, patch, 'milestone')
		}),
		delete_milestone: tool({
			description: 'Permanently delete a milestone and its steps. Only when the user asked.',
			inputSchema: z.object({ id }),
			execute: async ({ id: milestoneId }) => remove(context, 'milestones', milestoneId, 'milestone')
		}),

		list_incidents: tool({
			description: 'List incidents in this project.',
			inputSchema: z.object({}),
			execute: async () => rows(context, 'incidents', 'id, title, severity, status, created_at')
		}),
		create_incident: tool({
			description: 'Record an incident in this project.',
			inputSchema: z.object({
				title: z.string().min(1).max(200),
				description: z.string().max(4000).optional(),
				severity: z.enum(values(INCIDENT_SEVERITIES) as [string, ...string[]]).optional(),
				status: z.enum(values(INCIDENT_STATUSES) as [string, ...string[]]).optional()
			}),
			execute: async (input) => add(context, 'incidents', input, 'incident')
		}),
		update_incident: tool({
			description: 'Change an incident in this project.',
			inputSchema: z.object({
				id,
				title: z.string().min(1).max(200).optional(),
				description: z.string().max(4000).optional(),
				severity: z.enum(values(INCIDENT_SEVERITIES) as [string, ...string[]]).optional(),
				status: z.enum(values(INCIDENT_STATUSES) as [string, ...string[]]).optional()
			}),
			execute: async ({ id: incidentId, ...patch }) => {
				const next = { ...patch } as Record<string, unknown>;
				if (patch.status === 'resolved') next.resolved_at = new Date().toISOString();
				if (patch.status && patch.status !== 'resolved') next.resolved_at = null;
				return change(context, 'incidents', incidentId, next, 'incident');
			}
		}),

		add_comment: tool({
			description: 'Add a comment to a task in this project. Anyone in the workspace may comment.',
			inputSchema: z.object({
				task_id: id,
				body: z.string().min(1).max(5000)
			}),
			execute: async ({ task_id, body }) => {
				const { data: task } = await untyped(context)
					.from('tasks')
					.select('id')
					.eq('id', task_id)
					.eq('project_id', context.project.id)
					.maybeSingle();
				if (!task) return { error: 'That task is not in this project.' };
				const { error } = await untyped(context).from('task_comments').insert({
					task_id,
					body,
					author_user_id: context.profile.id,
					author_name: displayName(context.profile)
				});
				if (error) return { error: error.message };
				return { ok: true };
			}
		})
	};
}

export interface ChatTurn {
	role: 'user' | 'assistant';
	content: string;
}

/**
 * Runs MintAI for one message. History is the saved conversation, oldest first, not including
 * the new message. Earlier chats are summarised so the assistant remembers them.
 */
export async function runMintAi(input: {
	context: ProjectContext;
	history: ChatTurn[];
	memory: string;
	message: string;
}): Promise<{ text: string } | { error: string }> {
	if (!ANTHROPIC_API_KEY) return { error: 'MintAI is not configured yet. An Anthropic API key is missing.' };

	const anthropic = createAnthropic({ apiKey: ANTHROPIC_API_KEY });
	const project = input.context.project;
	const agent = new ToolLoopAgent({
		model: anthropic('claude-sonnet-4-5'),
		instructions: [
			`You are MintAI, the assistant inside the project "${project.name}".`,
			'You can read and change only this project, using your tools. You cannot see other projects, API keys, tokens or billing.',
			input.context.canEdit
				? 'This person can make changes. Delete something only when they clearly ask you to delete it.'
				: 'This person has view-only access. Do not try to create, edit or delete anything. Explain that they can only look.',
			'Read with a tool before you claim something exists. If a tool reports an error or a limit, say that in plain English.',
			'Keep replies short and concrete. Mention what you changed.',
			input.memory
		]
			.filter(Boolean)
			.join('\n'),
		tools: mintTools(input.context),
		stopWhen: isStepCount(8)
	});

	const messages: ModelMessage[] = [
		...input.history.map((turn) => ({ role: turn.role, content: turn.content })),
		{ role: 'user', content: input.message }
	];

	try {
		const result = await agent.generate({ messages });
		const text = result.text.trim();
		return { text: text || 'Done. I updated the project, but there is nothing more to add.' };
	} catch (cause) {
		console.error('MintAI failed:', cause);
		return { error: 'MintAI could not answer just now. Please try again in a moment.' };
	}
}

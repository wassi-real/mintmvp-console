import type { Json } from '#lib/database.types.ts';
import { displayName, type ProjectContext, type WorkspaceContext } from './context';
import { sendMail } from './mail.ts';
import { currentOrigin } from './origin.ts';
import { getServiceClient } from './supabase.ts';

/**
 * Appends to the project's activity history. A failure here must never block the action that
 * was just carried out, so it is reported to the server log and otherwise ignored.
 */
export async function logActivity(
	context: ProjectContext,
	action: string,
	metadata: Record<string, Json | undefined> = {}
): Promise<void> {
	const { error } = await context.supabase.from('activity_log').insert({
		project_id: context.project.id,
		action: action.slice(0, 300),
		actor: displayName(context.profile),
		metadata: { ...metadata, actor_id: context.profile.id }
	});
	if (error) console.error('activity_log insert failed:', error.message);
}

export interface NotificationInput {
	userId: string;
	kind: string;
	title: string;
	body?: string;
	link?: string;
	projectId?: string | null;
	/** The person is not in this workspace yet, so row level security would block the insert. */
	outsideWorkspace?: boolean;
}

/** Notifies another member of the active workspace. Never notifies the person acting. Returns whether the email went out. */
export async function notify(context: WorkspaceContext, input: NotificationInput): Promise<boolean> {
	if (input.userId === context.profile.id) return false;
	const { error } = await (input.outsideWorkspace ? getServiceClient() : context.supabase)
		.from('notifications')
		.insert({
		user_id: input.userId,
		organization_id: context.profile.organization_id,
		project_id: input.projectId ?? null,
		kind: input.kind,
		title: input.title.slice(0, 300),
		body: (input.body ?? '').slice(0, 1000),
		link: input.link ?? '',
		created_by: context.profile.id
	});
	if (error) {
		console.error('notification insert failed:', error.message);
		return false;
	}

	const { data: person } = await getServiceClient()
		.from('users')
		.select('email')
		.eq('id', input.userId)
		.maybeSingle();
	const email = person?.email?.trim();
	if (!email) return false;

	const path = input.link && input.link.startsWith('/') ? input.link : '';
	const origin = currentOrigin();
	const href = path && origin ? `${origin}${path}` : '';
	const sent = await sendMail({
		to: email,
		subject: input.title.slice(0, 200),
		title: input.title,
		body: input.body,
		href,
		action: href ? 'Open in Console' : undefined
	});
	if (!sent) console.error('notification email was not sent');
	return sent;
}

/** Notifies several workspace members at once (never the person acting). */
export async function notifyMany(
	context: WorkspaceContext,
	userIds: readonly (string | null | undefined)[],
	input: Omit<NotificationInput, 'userId'>
): Promise<void> {
	const unique = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
	await Promise.all(unique.map((userId) => notify(context, { ...input, userId })));
}
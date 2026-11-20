import { error, json } from '@sveltejs/kit';
import { ANTHROPIC_API_KEY } from '$app/env/private';
import { allowance, consumeAiRequest, refundAiRequest } from '#lib/server/billing.ts';
import { projectContext } from '#lib/server/context.ts';
import { untyped } from '#lib/server/crud.ts';
import { runMintAi, type ChatTurn } from '#lib/server/mintai.ts';
import { isUuid } from '#lib/server/validate.ts';
import type { RequestHandler } from './$types';

const HISTORY = 24;

async function chatsFor(context: Awaited<ReturnType<typeof projectContext>>) {
	const { data } = await untyped(context)
		.from('ai_chats')
		.select('id, title, updated_at')
		.eq('project_id', context.project.id)
		.eq('user_id', context.profile.id)
		.order('updated_at', { ascending: false })
		.limit(20);
	return (data ?? []) as { id: string; title: string; updated_at: string }[];
}

async function messagesFor(context: Awaited<ReturnType<typeof projectContext>>, chatId: string) {
	const { data } = await untyped(context)
		.from('ai_messages')
		.select('id, role, content, created_at')
		.eq('chat_id', chatId)
		.order('created_at')
		.limit(200);
	return (data ?? []) as { id: string; role: 'user' | 'assistant'; content: string; created_at: string }[];
}

export const GET: RequestHandler = async (event) => {
	const context = await projectContext(event);
	const plan = await allowance(context.supabase, context.profile.id);
	const chats = plan.ready ? await chatsFor(context) : [];
	const requested = event.url.searchParams.get('chat');
	const chatId =
		requested && chats.some((chat) => chat.id === requested) ? requested : (chats[0]?.id ?? null);
	const messages = chatId ? await messagesFor(context, chatId) : [];
	return json({
		ready: plan.ready,
		premium: plan.premium,
		used: plan.used,
		remaining: plan.remaining,
		configured: Boolean(ANTHROPIC_API_KEY),
		chats,
		chatId,
		messages
	});
};

export const POST: RequestHandler = async (event) => {
	const context = await projectContext(event);
	const body = (await event.request.json().catch(() => null)) as {
		message?: unknown;
		chatId?: unknown;
		newChat?: unknown;
	} | null;
	const message = typeof body?.message === 'string' ? body.message.trim() : '';
	if (!message) error(400, 'Write a message first.');
	if (message.length > 4000) error(400, 'Keep a message to 4,000 characters or fewer.');

	const plan = await allowance(context.supabase, context.profile.id);
	if (!plan.ready) error(503, 'MintAI storage is not ready yet. Apply the latest database migration.');
	if (!plan.premium) error(402, 'MintAI is part of Premium. It is $5 a month.');
	if (!ANTHROPIC_API_KEY) error(503, 'MintAI is not configured yet. An Anthropic API key is missing.');

	const spent = await consumeAiRequest(context.supabase, context.profile.id);
	if ('error' in spent) error(402, spent.error);

	const supabase = untyped(context);
	const existing = await chatsFor(context);
	let chatId = typeof body?.chatId === 'string' && isUuid(body.chatId) ? body.chatId : '';
	const startNew = body?.newChat === true || !chatId;

	if (startNew || !existing.some((chat) => chat.id === chatId)) {
		const title = message.slice(0, 80);
		const { data, error: failure } = await supabase
			.from('ai_chats')
			.insert({
				project_id: context.project.id,
				user_id: context.profile.id,
				title
			})
			.select('id')
			.single();
		if (failure || !data) {
			await refundAiRequest(context.profile.id);
			error(500, 'Could not save the chat. Please try again.');
		}
		chatId = String(data.id);
	}

	const previous = await messagesFor(context, chatId);
	const history: ChatTurn[] = previous.slice(-HISTORY).map((turn) => ({
		role: turn.role,
		content: turn.content
	}));

	const older = existing.filter((chat) => chat.id !== chatId).slice(0, 3);
	const memory = older.length
		? `Earlier chats in this project: ${older.map((chat) => chat.title).join('; ')}.`
		: '';

	const result = await runMintAi({ context, history, memory, message });
	if ('error' in result) {
		await refundAiRequest(context.profile.id);
		error(502, result.error);
	}

	const reply = result.text.slice(0, 20000);
	const { error: saveError } = await supabase.from('ai_messages').insert([
		{ chat_id: chatId, role: 'user', content: message },
		{ chat_id: chatId, role: 'assistant', content: reply }
	]);
	if (saveError) console.error('MintAI history save failed:', saveError.message);

	await supabase
		.from('ai_chats')
		.update({ updated_at: new Date().toISOString() })
		.eq('id', chatId)
		.eq('user_id', context.profile.id);

	return json({ chatId, reply, remaining: spent.remaining });
};

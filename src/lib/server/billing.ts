import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceClient } from './supabase.ts';
import { untyped } from './crud.ts';

export const AI_MONTHLY_LIMIT = 100;

export interface Allowance {
	/** False when the billing migration has not been applied yet. */
	ready: boolean;
	premium: boolean;
	used: number;
	remaining: number;
}

const LOCKED: Allowance = { ready: false, premium: false, used: 0, remaining: 0 };

function currentPeriod(): string {
	return new Date().toISOString().slice(0, 7);
}

function missingTable(error: { code?: string; message: string } | null): boolean {
	if (!error) return false;
	return error.code === 'PGRST205' || /could not find the table|does not exist/i.test(error.message);
}

function isPremium(row: { status?: string; current_period_end?: string | null } | null): boolean {
	if (!row) return false;
	if (row.status !== 'active' && row.status !== 'trialing') return false;
	if (!row.current_period_end) return true;
	return new Date(row.current_period_end).getTime() > Date.now();
}

/** Premium state and how many MintAI requests are left this month. */
export async function allowance(supabase: SupabaseClient, userId: string): Promise<Allowance> {
	const client = untyped({ supabase });
	const [subscription, usage] = await Promise.all([
		client
			.from('billing_subscriptions')
			.select('status, current_period_end')
			.eq('user_id', userId)
			.maybeSingle(),
		client
			.from('ai_usage')
			.select('requests')
			.eq('user_id', userId)
			.eq('period', currentPeriod())
			.maybeSingle()
	]);

	if (missingTable(subscription.error) || missingTable(usage.error)) return LOCKED;
	if (subscription.error) console.error('billing lookup failed:', subscription.error.message);
	if (usage.error) console.error('usage lookup failed:', usage.error.message);

	const premium = isPremium(subscription.data);
	const used = Number(usage.data?.requests ?? 0);
	return {
		ready: true,
		premium,
		used,
		remaining: premium ? Math.max(AI_MONTHLY_LIMIT - used, 0) : 0
	};
}

/** Uses one request. Returns how many remain, or a message the person can read. */
export async function consumeAiRequest(
	supabase: SupabaseClient,
	userId: string
): Promise<{ remaining: number } | { error: string }> {
	const plan = await allowance(supabase, userId);
	if (!plan.ready) return { error: 'MintAI storage is not ready yet.' };
	if (!plan.premium) return { error: 'MintAI is part of Premium. It is $5 a month.' };
	if (plan.remaining <= 0) return { error: 'You have used all 100 MintAI requests for this month.' };

	const client = untyped({ supabase: getServiceClient() });
	const period = currentPeriod();

	for (let attempt = 0; attempt < 4; attempt += 1) {
		const { data: row, error } = await client
			.from('ai_usage')
			.select('requests')
			.eq('user_id', userId)
			.eq('period', period)
			.maybeSingle();
		if (error) {
			console.error('usage read failed:', error.message);
			return { error: 'MintAI could not start. Please try again.' };
		}

		const used = Number(row?.requests ?? 0);
		if (used >= AI_MONTHLY_LIMIT) {
			return { error: 'You have used all 100 MintAI requests for this month.' };
		}

		if (!row) {
			const inserted = await client.from('ai_usage').insert({ user_id: userId, period, requests: 1 });
			if (!inserted.error) return { remaining: AI_MONTHLY_LIMIT - 1 };
			if (inserted.error.code !== '23505') {
				console.error('usage insert failed:', inserted.error.message);
				return { error: 'MintAI could not start. Please try again.' };
			}
			continue;
		}

		const updated = await client
			.from('ai_usage')
			.update({ requests: used + 1 })
			.eq('user_id', userId)
			.eq('period', period)
			.eq('requests', used)
			.select('requests')
			.maybeSingle();
		if (updated.error) {
			console.error('usage update failed:', updated.error.message);
			return { error: 'MintAI could not start. Please try again.' };
		}
		if (updated.data) return { remaining: AI_MONTHLY_LIMIT - Number(updated.data.requests) };
	}

	return { error: 'MintAI could not start. Please try again.' };
}

/** Gives a request back after the model itself failed. Not callable by the browser. */
export async function refundAiRequest(userId: string): Promise<void> {
	const client = untyped({ supabase: getServiceClient() });
	const period = currentPeriod();
	const { data: row } = await client
		.from('ai_usage')
		.select('requests')
		.eq('user_id', userId)
		.eq('period', period)
		.maybeSingle();
	const used = Number(row?.requests ?? 0);
	if (used <= 0) return;
	const { error } = await client
		.from('ai_usage')
		.update({ requests: used - 1 })
		.eq('user_id', userId)
		.eq('period', period)
		.eq('requests', used);
	if (error) console.error('usage refund failed:', error.message);
}

export interface SubscriptionRecord {
	status: string;
	currentPeriodEnd: string | null;
	customerId: string | null;
}

export async function subscriptionFor(
	supabase: SupabaseClient,
	userId: string
): Promise<SubscriptionRecord | null> {
	const { data, error } = await untyped({ supabase })
		.from('billing_subscriptions')
		.select('status, current_period_end, stripe_customer_id')
		.eq('user_id', userId)
		.maybeSingle();
	if (error || !data) return null;
	return {
		status: String(data.status),
		currentPeriodEnd: (data.current_period_end as string | null) ?? null,
		customerId: (data.stripe_customer_id as string | null) ?? null
	};
}

/** Called from the Stripe webhook. The service role is the only writer of this table. */
export async function saveSubscription(input: {
	userId: string;
	customerId: string | null;
	subscriptionId: string | null;
	status: string;
	currentPeriodEnd: string | null;
}): Promise<void> {
	const allowed = new Set([
		'inactive',
		'incomplete',
		'active',
		'trialing',
		'past_due',
		'canceled',
		'unpaid',
		'paused'
	]);
	const { error } = await untyped({ supabase: getServiceClient() })
		.from('billing_subscriptions')
		.upsert(
			{
				user_id: input.userId,
				stripe_customer_id: input.customerId,
				stripe_subscription_id: input.subscriptionId,
				status: allowed.has(input.status) ? input.status : 'inactive',
				current_period_end: input.currentPeriodEnd,
				updated_at: new Date().toISOString()
			},
			{ onConflict: 'user_id' }
		);
	if (error) console.error('saveSubscription failed:', error.message);
}

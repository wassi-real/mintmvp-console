import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceClient } from './supabase.ts';
import { untyped } from './crud.ts';

export interface PlanState {
	/** False when the billing migration has not been applied yet. */
	ready: boolean;
	premium: boolean;
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

/** Whether this person pays for Mint. */
export async function planFor(supabase: SupabaseClient, userId: string): Promise<PlanState> {
	const { data, error } = await untyped({ supabase })
		.from('billing_subscriptions')
		.select('status, current_period_end')
		.eq('user_id', userId)
		.maybeSingle();
	if (missingTable(error)) return { ready: false, premium: false };
	if (error) console.error('billing lookup failed:', error.message);
	return { ready: true, premium: isPremium(data) };
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

import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from '$app/env/private';
import Stripe from 'stripe';

export function stripeClient(): Stripe | null {
	if (!STRIPE_SECRET_KEY) return null;
	return new Stripe(STRIPE_SECRET_KEY);
}

export function webhookSecret(): string | null {
	return STRIPE_WEBHOOK_SECRET ?? null;
}

/** Stripe moved the period end onto the subscription item. Either place is accepted. */
export function periodEnd(subscription: Stripe.Subscription): string | null {
	const item = subscription.items?.data?.[0] as { current_period_end?: number } | undefined;
	const unix =
		item?.current_period_end ??
		(subscription as { current_period_end?: number }).current_period_end;
	return typeof unix === 'number' ? new Date(unix * 1000).toISOString() : null;
}

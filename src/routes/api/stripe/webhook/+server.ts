import { error, json } from '@sveltejs/kit';
import { saveSubscription } from '#lib/server/billing.ts';
import { getServiceClient } from '#lib/server/supabase.ts';
import { untyped } from '#lib/server/crud.ts';
import { periodEnd, stripeClient, webhookSecret } from '#lib/server/stripe.ts';
import type { RequestHandler } from './$types';

async function userForCustomer(customerId: string): Promise<string | null> {
	const { data } = await untyped({ supabase: getServiceClient() })
		.from('billing_subscriptions')
		.select('user_id')
		.eq('stripe_customer_id', customerId)
		.maybeSingle();
	return data ? String(data.user_id) : null;
}

export const POST: RequestHandler = async ({ request }) => {
	const stripe = stripeClient();
	const secret = webhookSecret();
	if (!stripe || !secret) error(503, 'Stripe is not configured.');

	const signature = request.headers.get('stripe-signature');
	if (!signature) error(400, 'Missing Stripe signature.');

	let event;
	try {
		event = stripe.webhooks.constructEvent(await request.text(), signature, secret);
	} catch (cause) {
		console.error('Stripe webhook rejected:', cause);
		error(400, 'Invalid Stripe signature.');
	}

	if (
		event.type === 'customer.subscription.updated' ||
		event.type === 'customer.subscription.deleted'
	) {
		const subscription = event.data.object;
		const customerId =
			typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
		const userId = subscription.metadata.user_id || (await userForCustomer(customerId));
		if (userId) {
			await saveSubscription({
				userId,
				customerId,
				subscriptionId: subscription.id,
				status: subscription.status,
				currentPeriodEnd: periodEnd(subscription)
			});
		}
	}

	if (event.type === 'checkout.session.completed') {
		const session = event.data.object;
		const userId = session.metadata?.user_id || session.client_reference_id;
		const customerId = typeof session.customer === 'string' ? session.customer : null;
		const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
		if (userId && subscriptionId) {
			const subscription = await stripe.subscriptions.retrieve(subscriptionId);
			await saveSubscription({
				userId,
				customerId,
				subscriptionId,
				status: subscription.status,
				currentPeriodEnd: periodEnd(subscription)
			});
		}
	}

	return json({ received: true });
};

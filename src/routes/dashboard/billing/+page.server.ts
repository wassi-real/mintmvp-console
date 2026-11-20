import { fail, redirect } from '@sveltejs/kit';
import { allowance, subscriptionFor } from '#lib/server/billing.ts';
import { workspaceContext } from '#lib/server/context.ts';
import { stripeClient } from '#lib/server/stripe.ts';
import type { Actions, PageServerLoad } from './$types';

const STRIPE_ORIGINS = ['https://checkout.stripe.com', 'https://billing.stripe.com'];

export const load: PageServerLoad = async (event) => {
	const { supabase, profile } = workspaceContext(event);
	const [plan, subscription] = await Promise.all([
		allowance(supabase, profile.id),
		subscriptionFor(supabase, profile.id)
	]);
	return {
		plan,
		subscription,
		stripeReady: Boolean(stripeClient()),
		checkout: event.url.searchParams.get('checkout')
	};
};

export const actions: Actions = {
	checkout: async (event) => {
		const { supabase, profile } = workspaceContext(event);
		const stripe = stripeClient();
		if (!stripe) return fail(503, { message: 'Billing is not configured yet. The Stripe secret key is missing.' });

		const current = await subscriptionFor(supabase, profile.id);
		const origin = event.url.origin;
		const session = await stripe.checkout.sessions.create({
			mode: 'subscription',
			customer: current?.customerId ?? undefined,
			customer_email: current?.customerId ? undefined : profile.email,
			client_reference_id: profile.id,
			metadata: { user_id: profile.id },
			line_items: [
				{
					quantity: 1,
					price_data: {
						currency: 'usd',
						unit_amount: 500,
						recurring: { interval: 'month' },
						product_data: {
							name: 'MintMVP Console Premium',
							description: 'Premium for one person. MintAI is included, with 100 requests a month.'
						}
					}
				}
			],
			subscription_data: { metadata: { user_id: profile.id } },
			success_url: `${origin}/dashboard/billing?checkout=success`,
			cancel_url: `${origin}/dashboard/billing?checkout=cancel`
		});
		if (!session.url) return fail(502, { message: 'Stripe did not return a checkout page. Please try again.' });
		redirect(303, session.url, { external: STRIPE_ORIGINS });
	},

	portal: async (event) => {
		const { supabase, profile } = workspaceContext(event);
		const stripe = stripeClient();
		const current = await subscriptionFor(supabase, profile.id);
		if (!stripe || !current?.customerId) {
			return fail(400, { message: 'There is no Stripe customer for this account yet.' });
		}
		const session = await stripe.billingPortal.sessions.create({
			customer: current.customerId,
			return_url: `${event.url.origin}/dashboard/billing`
		});
		redirect(303, session.url, { external: STRIPE_ORIGINS });
	}
};

import { fail, redirect } from '@sveltejs/kit';
import { planFor, subscriptionFor } from '#lib/server/billing.ts';
import { workspaceContext } from '#lib/server/context.ts';
import { untyped } from '#lib/server/crud.ts';
import { stripeClient } from '#lib/server/stripe.ts';
import { isMissingTable } from '#lib/server/work.ts';
import type { Actions, PageServerLoad } from './$types';

const STRIPE_ORIGINS = ['https://checkout.stripe.com', 'https://billing.stripe.com'];

export const load: PageServerLoad = async (event) => {
	const context = workspaceContext(event);
	const { supabase, profile } = context;
	const period = new Date().toISOString().slice(0, 7);
	const [plan, subscription, projects, usage] = await Promise.all([
		planFor(supabase, profile.id),
		subscriptionFor(supabase, profile.id),
		supabase.from('projects').select('id, name').order('name'),
		untyped(context).from('api_usage_monthly').select('project_id, writes, reads').eq('period', period)
	]);
	const counts = new Map(
		((usage.data ?? []) as { project_id: string; writes: number; reads: number }[]).map((row) => [row.project_id, row])
	);
	return {
		plan,
		subscription,
		stripeReady: Boolean(stripeClient()),
		checkout: event.url.searchParams.get('checkout'),
		usageReady: !isMissingTable(usage.error),
		usage: (projects.data ?? []).map((project) => ({
			id: project.id,
			name: project.name,
			writes: Number(counts.get(project.id)?.writes ?? 0),
			reads: Number(counts.get(project.id)?.reads ?? 0)
		}))
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
							name: 'Mint Console',
							description: 'Unlimited projects and work, and more room for your agents on the API.'
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

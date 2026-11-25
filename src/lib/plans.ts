// Plan limits. Shown on the landing page, the plan page and the API docs, and enforced by the
// server and the database. Keep the numbers here in step with the migration triggers.

export interface Plan {
	name: string;
	price: number;
	/** Projects in one workspace. Null means no cap. */
	projects: number | null;
	/** New work items per project each month. Null means no cap. */
	workPerMonth: number | null;
	/** Requests per minute for one API key. */
	apiPerMinute: number;
	/** Create, update and delete requests per project each month. Reads are not capped. */
	apiWritesPerMonth: number;
}

export const PLANS = {
	free: {
		name: 'Free',
		price: 0,
		projects: 1,
		workPerMonth: 20,
		apiPerMinute: 30,
		apiWritesPerMonth: 1000
	},
	mint: {
		name: 'Mint',
		price: 5,
		projects: null,
		workPerMonth: null,
		apiPerMinute: 120,
		apiWritesPerMonth: 20000
	}
} as const satisfies Record<string, Plan>;

export type PlanId = keyof typeof PLANS;

export function planOf(premium: boolean): Plan {
	return premium ? PLANS.mint : PLANS.free;
}

export function formatLimit(value: number | null): string {
	return value === null ? 'Unlimited' : value.toLocaleString('en-US');
}

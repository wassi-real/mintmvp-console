import type { PageServerLoad } from './$types';
import { loadPublicMonitoringByToken } from '$lib/server/public-monitoring';

export const load: PageServerLoad = async ({ params }) => {
	return await loadPublicMonitoringByToken(params.token);
};

import { apiOptions } from '#lib/server/public-api.ts';
import { handleWorkAction } from '#lib/server/public-work.ts';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = (event) => handleWorkAction(event);
export const OPTIONS: RequestHandler = () => apiOptions();

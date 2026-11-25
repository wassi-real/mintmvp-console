import { apiOptions } from '#lib/server/public-api.ts';
import { handleWorkList } from '#lib/server/public-work.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = (event) => handleWorkList(event);
export const POST: RequestHandler = (event) => handleWorkList(event);
export const OPTIONS: RequestHandler = () => apiOptions();

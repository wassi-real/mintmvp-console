import { apiOptions } from '#lib/server/public-api.ts';
import { handleWorkItem } from '#lib/server/public-work.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = (event) => handleWorkItem(event);
export const PATCH: RequestHandler = (event) => handleWorkItem(event);
export const OPTIONS: RequestHandler = () => apiOptions();

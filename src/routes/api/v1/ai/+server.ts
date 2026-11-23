import { apiOptions, handleAi } from '#lib/server/public-api.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = (event) => handleAi(event);
export const POST: RequestHandler = (event) => handleAi(event);
export const OPTIONS: RequestHandler = () => apiOptions();

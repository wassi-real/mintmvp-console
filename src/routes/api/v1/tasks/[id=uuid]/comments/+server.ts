import { apiOptions, handleComments } from '#lib/server/public-api.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = (event) => handleComments(event);
export const POST: RequestHandler = (event) => handleComments(event);
export const OPTIONS: RequestHandler = () => apiOptions();

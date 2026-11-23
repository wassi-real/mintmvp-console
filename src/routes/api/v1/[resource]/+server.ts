import { apiOptions, handleCollection } from '#lib/server/public-api.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = (event) => handleCollection(event);
export const POST: RequestHandler = (event) => handleCollection(event);
export const PATCH: RequestHandler = (event) => handleCollection(event);
export const OPTIONS: RequestHandler = () => apiOptions();

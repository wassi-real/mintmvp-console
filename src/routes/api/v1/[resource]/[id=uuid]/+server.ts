import { apiOptions, handleItem } from '#lib/server/public-api.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = (event) => handleItem(event);
export const PATCH: RequestHandler = (event) => handleItem(event);
export const DELETE: RequestHandler = (event) => handleItem(event);
export const OPTIONS: RequestHandler = () => apiOptions();

import { apiOptions, handleIndex } from '#lib/server/public-api.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = (event) => handleIndex(event);
export const OPTIONS: RequestHandler = () => apiOptions();

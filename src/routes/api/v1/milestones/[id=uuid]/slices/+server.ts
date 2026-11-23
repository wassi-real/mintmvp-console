import { apiOptions, handleSlices } from '#lib/server/public-api.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = (event) => handleSlices(event);
export const POST: RequestHandler = (event) => handleSlices(event);
export const OPTIONS: RequestHandler = () => apiOptions();

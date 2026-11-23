import { apiOptions, handleSlice } from '#lib/server/public-api.ts';
import type { RequestHandler } from './$types';

export const PATCH: RequestHandler = (event) => handleSlice(event);
export const DELETE: RequestHandler = (event) => handleSlice(event);
export const OPTIONS: RequestHandler = () => apiOptions();

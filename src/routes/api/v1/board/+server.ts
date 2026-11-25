import { apiOptions } from '#lib/server/public-api.ts';
import { handleBoard } from '#lib/server/public-work.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = (event) => handleBoard(event);
export const OPTIONS: RequestHandler = () => apiOptions();

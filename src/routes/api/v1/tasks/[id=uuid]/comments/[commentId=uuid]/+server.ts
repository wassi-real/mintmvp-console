import { apiOptions, handleComment } from '#lib/server/public-api.ts';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = (event) => handleComment(event);
export const OPTIONS: RequestHandler = () => apiOptions();

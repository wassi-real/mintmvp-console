import { AsyncLocalStorage } from 'node:async_hooks';

const origins = new AsyncLocalStorage<string>();

/** Keeps the current request's public origin available to code that has no event object. */
export function withOrigin<T>(origin: string, run: () => T): T {
	return origins.run(origin, run);
}

export function currentOrigin(): string {
	return origins.getStore() ?? '';
}

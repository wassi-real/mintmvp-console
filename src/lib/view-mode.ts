export type ViewMode = 'grid' | 'list';

/** Persisted in a cookie so the server renders the same layout the user last chose. */
export const VIEW_MODE_COOKIE = 'mint_view';

export function parseViewMode(value: string | undefined | null, fallback: ViewMode = 'grid'): ViewMode {
	return value === 'grid' || value === 'list' ? value : fallback;
}

export function persistViewMode(mode: ViewMode) {
	document.cookie = `${VIEW_MODE_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax`;
}

/** Persisted in a cookie so the server renders the sidebar at the width the user left it. */
export const SIDEBAR_COOKIE = 'mint_sidebar';

export function parseSidebarCollapsed(value: string | undefined | null): boolean {
	return value === 'collapsed';
}

export function persistSidebarCollapsed(collapsed: boolean) {
	document.cookie = `${SIDEBAR_COOKIE}=${collapsed ? 'collapsed' : 'expanded'}; path=/; max-age=31536000; samesite=lax`;
}

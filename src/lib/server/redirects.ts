/**
 * Accepts only same-site paths such as "/dashboard/projects", so a crafted ?next= value cannot
 * send someone to another website after they sign in.
 */
export function safeNext(value: string | null | undefined, fallback: string): string {
	if (!value) return fallback;
	if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
	if (/[\u0000-\u001f]/.test(value)) return fallback;
	if (value === '/auth' || value.startsWith('/auth?') || value.startsWith('/auth/')) return fallback;
	return value;
}

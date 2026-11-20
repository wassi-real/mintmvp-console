const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-20" -> "20 Nov 2026". Date-only values have no time zone, so none is applied. */
export function formatDate(value: string | null | undefined): string {
	if (!value) return '';
	const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
	if (!match) return value;
	return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

/** Same on the server and in the browser, so it is safe for the first render. */
export function formatDateTimeUtc(value: string | null | undefined): string {
	if (!value) return '';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	const iso = date.toISOString();
	return `${formatDate(iso)}, ${iso.slice(11, 16)} UTC`;
}

export function formatDateTimeLocal(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function formatRelative(value: string, now = Date.now()): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return value;
	const seconds = Math.round((now - date.getTime()) / 1000);
	if (seconds < 0) return formatDateTimeLocal(value);
	if (seconds < 60) return 'just now';
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
	const days = Math.floor(hours / 24);
	if (days < 30) return days === 1 ? 'yesterday' : `${days} days ago`;
	return formatDate(date.toISOString());
}

export function formatMoney(value: number | null | undefined): string {
	return new Intl.NumberFormat('en-US', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 2
	}).format(value ?? 0);
}

export function formatNumber(value: number): string {
	return new Intl.NumberFormat('en-US').format(value);
}

export function percent(part: number, whole: number): number {
	return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export function today(): string {
	return new Date().toISOString().slice(0, 10);
}

export function isOverdue(date: string | null | undefined): boolean {
	return Boolean(date) && String(date).slice(0, 10) < today();
}

export function initials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return '?';
	return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function shortSha(sha: string | null | undefined): string {
	return (sha ?? '').slice(0, 7);
}

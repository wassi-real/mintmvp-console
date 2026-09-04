import { invalidateAll } from '$app/navigation';
import { createClient } from '$lib/supabase/client';

/**
 * Re-runs the page `load` whenever any of `tables` changes in Postgres.
 *
 * Updates are debounced so a burst of writes costs one refresh, and refreshes
 * are deferred while the tab is hidden to avoid pointless work in background tabs.
 *
 * Returns a cleanup function, so call it from inside `$effect`.
 */
export function liveRefresh(tables: string[], debounceMs = 250): () => void {
	const supabase = createClient();
	const channel = supabase.channel(`live:${tables.join(',')}:${Math.random().toString(36).slice(2)}`);

	let timer: ReturnType<typeof setTimeout> | null = null;
	let missedWhileHidden = false;

	const refresh = () => {
		timer = null;
		if (document.visibilityState === 'hidden') {
			missedWhileHidden = true;
			return;
		}
		void invalidateAll();
	};

	const schedule = () => {
		if (timer) clearTimeout(timer);
		timer = setTimeout(refresh, debounceMs);
	};

	const onVisible = () => {
		if (document.visibilityState === 'visible' && missedWhileHidden) {
			missedWhileHidden = false;
			void invalidateAll();
		}
	};

	for (const table of tables) {
		// Supabase's `.on()` overloads don't narrow well for dynamic table names.
		(channel as any).on('postgres_changes', { event: '*', schema: 'public', table }, schedule);
	}
	channel.subscribe();
	document.addEventListener('visibilitychange', onVisible);

	return () => {
		if (timer) clearTimeout(timer);
		document.removeEventListener('visibilitychange', onVisible);
		void supabase.removeChannel(channel);
	};
}

/** Tables that feed the dashboard and projects overview cards. */
export const OVERVIEW_TABLES = ['projects', 'tasks', 'tests', 'incidents', 'deployments'];

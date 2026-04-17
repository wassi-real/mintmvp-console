export type DeployLogSignal = {
	kind: 'error' | 'warn' | 'deploy_lifecycle' | 'runtime_health';
	severity: 'error' | 'warn' | 'info';
	title: string;
	detail: string;
};

function norm(s: string | null | undefined): string {
	return (s ?? '').trim().toLowerCase();
}

export function logAttributesToRecord(
	attrs: { key: string; value: string }[] | null | undefined
): Record<string, string> {
	const out: Record<string, string> = {};
	for (const a of attrs ?? []) {
		if (a?.key) out[a.key] = a.value ?? '';
	}
	return out;
}

export function inferSeverityFromAttrs(attrs: Record<string, string>, message: string): string | null {
	const level = norm(attrs['level'] || attrs['severity'] || attrs['@level']);
	if (level) return level;
	const m = message;
	if (/\b(ERROR|FATAL|CRITICAL)\b/.test(m)) return 'error';
	if (/\b(WARN|WARNING)\b/.test(m)) return 'warn';
	return null;
}

/**
 * Lightweight log parsing (Datadog/Sentry-style signals) for deploy/build streams.
 */
export function extractSignalsFromLogLine(
	message: string,
	attrs: Record<string, string>
): DeployLogSignal[] {
	const signals: DeployLogSignal[] = [];
	const msg = message.trim();
	if (!msg) return signals;

	const level = inferSeverityFromAttrs(attrs, msg);
	const low = msg.toLowerCase();

	if (level === 'error' || /\berror\b|\bfatal\b|\bpanic\b|\bunhandled\b|\beconnrefused\b|\bexception\b|\btraceback\b/.test(low)) {
		signals.push({
			kind: 'error',
			severity: 'error',
			title: 'Error pattern in log',
			detail: msg.length > 800 ? `${msg.slice(0, 800)}…` : msg
		});
	} else if (level === 'warn' || /\bwarn(ing)?\b|\bdeprecated\b|\b429\b|\btoo many requests\b/.test(low)) {
		signals.push({
			kind: 'warn',
			severity: 'warn',
			title: 'Warning pattern in log',
			detail: msg.length > 600 ? `${msg.slice(0, 600)}…` : msg
		});
	}

	if (
		/\b(listening on|application startup complete|started server|ready in \d|uvicorn running|serving on)\b/i.test(
			msg
		)
	) {
		signals.push({
			kind: 'runtime_health',
			severity: 'info',
			title: 'Runtime readiness signal',
			detail: msg.length > 400 ? `${msg.slice(0, 400)}…` : msg
		});
	}

	if (
		/\b(deploy(ment)? (complete|succeeded|finished)|build succeeded|starting container|health check passed)\b/i.test(
			msg
		)
	) {
		signals.push({
			kind: 'deploy_lifecycle',
			severity: 'info',
			title: 'Deploy lifecycle',
			detail: msg.length > 400 ? `${msg.slice(0, 400)}…` : msg
		});
	}

	return signals;
}

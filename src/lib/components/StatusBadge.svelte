<script lang="ts">
	let {
		status,
		size = 'default'
	}: {
		status: string;
		size?: 'sm' | 'default';
	} = $props();

	const colorMap: Record<string, string> = {
		// task statuses
		backlog: 'bg-zinc-700 text-zinc-200',
		in_progress: 'bg-blue-900/60 text-blue-300',
		review: 'bg-purple-900/60 text-purple-300',
		testing: 'bg-amber-900/60 text-amber-300',
		deployed: 'bg-green-900/60 text-green-300',
		// spec statuses
		draft: 'bg-zinc-700 text-zinc-200',
		approved: 'bg-blue-900/60 text-blue-300',
		in_dev: 'bg-amber-900/60 text-amber-300',
		completed: 'bg-green-900/60 text-green-300',
		// project statuses
		active: 'bg-green-900/60 text-green-300',
		maintenance: 'bg-amber-900/60 text-amber-300',
		paused: 'bg-zinc-700 text-zinc-200',
		// test statuses
		pass: 'bg-green-900/60 text-green-300',
		fail: 'bg-red-900/60 text-red-300',
		pending: 'bg-zinc-700 text-zinc-200',
		// deploy statuses
		success: 'bg-green-900/60 text-green-300',
		failed: 'bg-red-900/60 text-red-300',
		// environments
		staging: 'bg-sky-900/60 text-sky-300',
		production: 'bg-indigo-900/60 text-indigo-300',
		// test types
		unit: 'bg-cyan-900/60 text-cyan-300',
		integration: 'bg-violet-900/60 text-violet-300',
		smoke: 'bg-orange-900/60 text-orange-300',
		manual: 'bg-zinc-600 text-zinc-200',
		// incident statuses
		open: 'bg-red-900/60 text-red-300',
		investigating: 'bg-amber-900/60 text-amber-300',
		resolved: 'bg-green-900/60 text-green-300',
		// severity
		low: 'bg-zinc-700 text-zinc-200',
		medium: 'bg-amber-900/60 text-amber-300',
		high: 'bg-orange-900/60 text-orange-300',
		critical: 'bg-red-900/60 text-red-300'
	};

	const sizeClasses = {
		sm: 'px-2 py-0.5 text-xs',
		default: 'px-3 py-1 text-sm'
	};
</script>

<span
	class="inline-flex items-center rounded-full font-semibold capitalize {colorMap[status] ??
		'bg-zinc-700 text-zinc-200'} {sizeClasses[size]}"
>
	{status.replace(/_/g, ' ')}
</span>

<script lang="ts">
	import { navigating } from '$app/stores';
	import { onMount } from 'svelte';

	/** Full-width flash when navigation completes */
	let finishing = $state(false);

	onMount(() => {
		let prev = false;
		const unsub = navigating.subscribe((n) => {
			const loading = n !== null;
			if (prev && !loading) {
				finishing = true;
				window.setTimeout(() => (finishing = false), 260);
			}
			prev = loading;
		});
		return unsub;
	});
</script>

<div
	class="pointer-events-none fixed left-0 right-0 top-0 z-[9999] h-1 overflow-hidden"
	aria-hidden="true"
	role="presentation"
>
	{#if $navigating}
		<div class="nav-progress-track">
			<div class="nav-progress-indeterminate"></div>
		</div>
	{:else if finishing}
		<div class="nav-progress-complete"></div>
	{/if}
</div>

<style>
	.nav-progress-track {
		height: 3px;
		width: 100%;
		background: rgba(76, 29, 149, 0.25);
	}

	.nav-progress-indeterminate {
		height: 100%;
		width: 45%;
		background: linear-gradient(
			90deg,
			#4c1d95 0%,
			#7c3aed 40%,
			#a78bfa 70%,
			#7c3aed 100%
		);
		background-size: 200% 100%;
		box-shadow: 0 0 12px rgba(139, 92, 246, 0.65);
		animation: nav-sweep 0.85s ease-in-out infinite, nav-shimmer 1.1s linear infinite;
	}

	.nav-progress-complete {
		height: 3px;
		width: 100%;
		background: linear-gradient(90deg, #4c1d95, #a78bfa);
		box-shadow: 0 0 10px rgba(167, 139, 250, 0.5);
		animation: nav-finish 0.26s ease-out forwards;
		transform-origin: left;
	}

	@keyframes nav-sweep {
		0% {
			transform: translateX(-100%);
		}
		100% {
			transform: translateX(280%);
		}
	}

	@keyframes nav-shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	@keyframes nav-finish {
		0% {
			transform: scaleX(0.2);
			opacity: 1;
		}
		55% {
			transform: scaleX(1);
			opacity: 1;
		}
		100% {
			transform: scaleX(1);
			opacity: 0;
		}
	}
</style>

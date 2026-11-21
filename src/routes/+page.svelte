<script lang="ts">
	import ArrowRight from '@lucide/svelte/icons/arrow-right';
	import Check from '@lucide/svelte/icons/check';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import GitBranch from '@lucide/svelte/icons/git-branch';
	import HeartPulse from '@lucide/svelte/icons/heart-pulse';
	import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
	import Mail from '@lucide/svelte/icons/mail';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Users from '@lucide/svelte/icons/users';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const startHref = $derived(data.signedIn ? '/dashboard' : '/auth?mode=signup');
	const startLabel = $derived(data.signedIn ? 'Open dashboard' : 'Get started');
	const CONTACT = 'hello@mintmvp.com';

	const features = [
		{
			icon: LayoutDashboard,
			index: '01',
			title: 'One project home',
			text: 'Tasks, milestones, specs, reports and activity sit in the same place.'
		},
		{
			icon: GitBranch,
			index: '02',
			title: 'Delivery in view',
			text: 'GitHub, builds, deploys and environments, without a second tool.'
		},
		{
			icon: HeartPulse,
			index: '03',
			title: 'Ops that stay calm',
			text: 'Monitoring and incidents, with a count of what is still open.'
		},
		{
			icon: Users,
			index: '04',
			title: 'Roles that fit',
			text: 'Owners and developers edit. Clients can look without changing anything.'
		}
	];

	const free = [
		'Look through the whole workspace',
		'2 projects',
		'Each month, per project: 30 tasks, 3 milestones, 5 reports, 3 specs, 5 incidents',
		'MintAI stays off'
	];
	const premium = [
		'Unlimited projects, tasks, milestones and incidents',
		'Each month, per project: 40 reports and 20 specs',
		'MintAI in every project: create, edit, delete and read',
		'100 MintAI requests a month, chats saved'
	];

	const faqs = [
		{
			q: 'What do I get for $5?',
			a: 'Premium is $5 a month for your account. It lifts the tight free limits and turns MintAI on.'
		},
		{
			q: 'How does MintAI work?',
			a: 'It lives inside one project at a time. It can read and change that project’s tasks, specs, reports, milestones and incidents. Chats are saved. You get 100 requests a month.'
		},
		{
			q: 'Can I start without a card?',
			a: 'Yes. The free plan needs no payment. Subscribe only when you want Premium.'
		},
		{
			q: 'Can I cancel?',
			a: 'Yes, any time, from Billing in the dashboard. Stripe handles the subscription.'
		}
	];

	let openFaq = $state(0);
	let sent = $state(false);

	function reveal(node: HTMLElement) {
		const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reduce) return;
		const show = () => {
			node.style.opacity = '1';
			node.style.transform = 'none';
			node.style.transition = 'opacity 0.55s var(--ease), transform 0.55s var(--ease)';
		};
		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry?.isIntersecting) return;
				show();
				observer.disconnect();
			},
			{ threshold: 0.18, rootMargin: '0px 0px -8% 0px' }
		);
		observer.observe(node);
		return { destroy: () => observer.disconnect() };
	}

	function contact(event: SubmitEvent) {
		event.preventDefault();
		const form = event.currentTarget as HTMLFormElement;
		const body = new FormData(form);
		const name = String(body.get('name') ?? '').trim();
		const email = String(body.get('email') ?? '').trim();
		const message = String(body.get('message') ?? '').trim();
		const text = `Name: ${name}\nEmail: ${email}\n\n${message}`;
		window.location.href = `mailto:${CONTACT}?subject=${encodeURIComponent('MintMVP Console')}&body=${encodeURIComponent(text)}`;
		sent = true;
	}
</script>

<svelte:head>
	<title>MintMVP Console</title>
	<meta
		name="description"
		content="One workspace for projects, delivery and MintAI. Free to start. Premium is $5 a month."
	/>
</svelte:head>

<div class="landing">
	<header class="nav-bar">
		<div class="shell nav">
			<a href="#top" class="brand">
				<img src="/logo-64.png" alt="" width="32" height="32" class="size-8 rounded-[9px]" />
				<span>Console</span>
			</a>
			<nav aria-label="Page">
				<a href="#features">Features</a>
				<a href="#ai">MintAI</a>
				<a href="#pricing">Pricing</a>
				<a href="#faq">FAQ</a>
				<a href="#contact">Contact</a>
			</nav>
			<a href={startHref} class="btn btn-primary btn-sm">{startLabel}</a>
		</div>
	</header>

	<main>
		<section id="top" class="hero">
			<div class="hero-copy">
				<p class="eyebrow">Project console</p>
				<h1>Ship the project from one screen.</h1>
				<p class="lead">
					Tasks, reports, deploys and a project assistant. Short to learn. Ready when you are.
				</p>
				<div class="hero-actions">
					<a href={startHref} class="btn btn-primary btn-lg">
						{startLabel} <ArrowRight size={20} />
					</a>
					<a href="#pricing" class="btn btn-lg">See pricing</a>
				</div>
			</div>

			<div class="stage" aria-hidden="true">
				<div class="mock">
					<aside>
						<span class="dot"></span>
						<span></span>
						<span></span>
						<span class="short"></span>
						<span></span>
					</aside>
					<div class="mock-main">
						<div class="mock-top">
							<strong>Overview</strong>
							<span class="pill">On track</span>
						</div>
						<div class="stats">
							<div><b>12</b><small>Open tasks</small></div>
							<div><b>3</b><small>Deploys</small></div>
							<div><b>0</b><small>Incidents</small></div>
						</div>
						<div class="rows">
							<span></span>
							<span></span>
							<span class="half"></span>
						</div>
					</div>
				</div>
				<div class="float-card">
					<Sparkles size={16} />
					<span>MintAI updated the milestone</span>
				</div>
			</div>
		</section>

		<section id="features" class="block reveal" use:reveal>
			<div class="block-head">
				<p class="eyebrow">Features</p>
				<h2>The work, not another dashboard.</h2>
			</div>
			<div class="cards stagger">
				{#each features as feature (feature.title)}
					<article class="panel card">
						<div class="card-top">
							<span class="card-icon"><feature.icon size={20} /></span>
							<span class="card-index">{feature.index}</span>
						</div>
						<h3>{feature.title}</h3>
						<p>{feature.text}</p>
					</article>
				{/each}
			</div>
		</section>

		<section id="ai" class="block reveal" use:reveal>
			<div class="ai panel">
				<div>
					<p class="eyebrow">MintAI</p>
					<h2>An assistant that stays inside the project.</h2>
					<p class="lead">
						Ask it to add a task, rewrite a report, or check what is blocked. It only touches the
						project you have open. Premium required. 100 requests a month.
					</p>
					<ul class="ticks">
						<li><Check size={18} /> Create, edit, delete and read</li>
						<li><Check size={18} /> Chats are saved</li>
						<li><Check size={18} /> Locked on the free plan</li>
					</ul>
				</div>
				<div class="chat" aria-hidden="true">
					<p class="bubble me">Add a task for the staging check.</p>
					<p class="bubble">Done. “Staging check” is in To do, due Friday.</p>
					<p class="bubble me">Move it to In progress.</p>
					<p class="bubble">Moved. One open task left on that milestone.</p>
				</div>
			</div>
		</section>

		<section id="pricing" class="block reveal" use:reveal>
			<div class="block-head">
				<p class="eyebrow">Pricing</p>
				<h2>Free to look. $5 to go further.</h2>
			</div>
			<div class="prices">
				<article class="panel price">
					<p class="eyebrow">Free</p>
					<p class="amount">$0</p>
					<ul>
						{#each free as item (item)}
							<li><Check size={18} /> {item}</li>
						{/each}
					</ul>
					<a href={startHref} class="btn btn-block">Start free</a>
				</article>
				<article class="panel price featured">
					<p class="mark">Recommended</p>
					<p class="eyebrow">Premium</p>
					<p class="amount">$5<span>/ month</span></p>
					<ul>
						{#each premium as item (item)}
							<li><Check size={18} /> {item}</li>
						{/each}
					</ul>
					<a href={data.signedIn ? '/dashboard/billing' : '/auth?mode=signup'} class="btn btn-primary btn-block">
						Get Premium
					</a>
				</article>
			</div>
		</section>

		<section id="faq" class="block reveal" use:reveal>
			<div class="block-head">
				<p class="eyebrow">FAQ</p>
				<h2>Straight answers.</h2>
			</div>
			<div class="faq">
				{#each faqs as item, i (item.q)}
					<div class="panel faq-item" class:open={openFaq === i}>
						<button type="button" aria-expanded={openFaq === i} onclick={() => (openFaq = openFaq === i ? -1 : i)}>
							{item.q}
							<span class="chev" class:open={openFaq === i}><ChevronDown size={20} /></span>
						</button>
						{#if openFaq === i}
							<p>{item.a}</p>
						{/if}
					</div>
				{/each}
			</div>
		</section>

		<section id="contact" class="block reveal" use:reveal>
			<div class="contact panel">
				<div>
					<p class="eyebrow">Contact</p>
					<h2>Say hello.</h2>
					<p class="lead">
						The form opens your email app to <a class="link" href="mailto:{CONTACT}">{CONTACT}</a>.
						Nothing is stored on this page.
					</p>
				</div>
				<form onsubmit={contact}>
					<label class="label" for="contact-name">Name</label>
					<input id="contact-name" name="name" class="input" required maxlength="80" autocomplete="name" />
					<label class="label" for="contact-email">Email</label>
					<input id="contact-email" name="email" type="email" class="input" required maxlength="120" autocomplete="email" />
					<label class="label" for="contact-message">Message</label>
					<textarea id="contact-message" name="message" class="textarea" rows="4" required maxlength="2000"></textarea>
					<button type="submit" class="btn btn-primary">
						<Mail size={18} /> {sent ? 'Open email again' : 'Send message'}
					</button>
				</form>
			</div>
		</section>
	</main>

	<footer class="shell">
		<p>Console</p>
		<a href={startHref}>{startLabel}</a>
	</footer>
</div>

<style>
	.landing {
		--cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28'%3E%3Crect x='1.5' y='1.5' width='25' height='25' rx='8' fill='%23000' stroke='%23fff' stroke-width='2'/%3E%3Crect x='11' y='11' width='6' height='6' rx='1.5' fill='%23fff'/%3E%3C/svg%3E") 14 14, auto;
		--cursor-hot: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32'%3E%3Crect x='1.5' y='1.5' width='29' height='29' rx='10' fill='%23fff' stroke='%23000' stroke-width='2'/%3E%3C/svg%3E") 16 16, pointer;
		min-height: 100dvh;
		cursor: var(--cursor);
	}

	.shell {
		width: min(72rem, calc(100% - 2.5rem));
		margin-inline: auto;
	}

	.nav-bar {
		position: sticky;
		top: 0;
		z-index: 20;
		padding: 0.85rem 0 0.4rem;
	}
	.nav {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-height: 4.1rem;
		padding: 0.45rem 0.5rem 0.45rem 0.85rem;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: color-mix(in srgb, var(--surface) 86%, transparent);
		backdrop-filter: blur(18px);
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		text-decoration: none;
	}
	.nav nav {
		display: none;
		gap: 0.35rem;
		margin-right: auto;
	}
	.nav nav a {
		padding: 0.45rem 0.8rem;
		border-radius: var(--r-sm);
		color: var(--fg-muted);
		font-weight: 600;
		text-decoration: none;
	}
	.nav nav a:hover {
		background: var(--surface-2);
		color: var(--fg);
	}
	.nav > .btn {
		margin-left: auto;
	}

	.hero {
		display: grid;
		gap: 4.5rem;
		align-items: center;
		width: min(72rem, calc(100% - 2.5rem));
		margin: 0 auto;
		padding: 6.5rem 0 3rem;
	}
	.hero-copy h1 {
		margin-top: 1.1rem;
		font-size: clamp(3.4rem, 7.2vw, 6.1rem);
		line-height: 0.98;
		animation: rise 0.5s var(--ease) both;
	}
	.lead {
		margin-top: 1.35rem;
		max-width: 34rem;
		color: var(--fg-muted);
		font-size: 1.25rem;
	}
	.hero-copy .lead {
		animation: rise 0.5s var(--ease) 80ms both;
	}
	.hero-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.9rem;
		margin-top: 2.5rem;
		animation: rise 0.5s var(--ease) 140ms both;
	}

	.stage {
		position: relative;
		animation: rise 0.6s var(--ease) 120ms both;
	}
	.mock {
		display: grid;
		grid-template-columns: 7.5rem 1fr;
		min-height: 28rem;
		overflow: hidden;
		border: 1px solid var(--line-strong);
		border-radius: var(--r-xl);
		background: var(--surface);
		box-shadow: var(--shadow);
		animation: float 5.5s ease-in-out infinite;
	}
	.mock aside {
		display: grid;
		align-content: start;
		gap: 0.7rem;
		padding: 1.1rem;
		border-right: 1px solid var(--line);
		background: var(--surface-2);
	}
	.mock aside span,
	.rows span {
		display: block;
		height: 0.7rem;
		border-radius: 999px;
		background: var(--surface-3);
	}
	.mock aside .dot {
		width: 2rem;
		height: 2rem;
		border-radius: 0.7rem;
		background: var(--fg);
	}
	.mock aside .short {
		width: 60%;
	}
	.mock-main {
		padding: 1.2rem;
	}
	.mock-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.pill {
		padding: 0.2rem 0.65rem;
		border-radius: 999px;
		background: color-mix(in srgb, var(--ok) 18%, transparent);
		color: var(--ok);
		font-size: 0.8rem;
		font-weight: 700;
	}
	.stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.7rem;
		margin-top: 1.1rem;
	}
	.stats div {
		padding: 0.9rem;
		border-radius: var(--r-md);
		background: var(--surface-2);
	}
	.stats b {
		display: block;
		font-size: 1.4rem;
	}
	.stats small {
		color: var(--fg-faint);
	}
	.rows {
		display: grid;
		gap: 0.65rem;
		margin-top: 1.2rem;
	}
	.rows .half {
		width: 55%;
	}
	.float-card {
		position: absolute;
		right: -0.4rem;
		bottom: -1rem;
		display: flex;
		align-items: center;
		gap: 0.55rem;
		padding: 0.85rem 1rem;
		border: 1px solid var(--line-strong);
		border-radius: var(--r-lg);
		background: var(--surface);
		box-shadow: var(--shadow);
		font-size: 0.92rem;
		font-weight: 600;
		animation: float 5.5s ease-in-out 0.4s infinite;
	}

	.block {
		width: min(72rem, calc(100% - 2.5rem));
		margin: 0 auto;
		padding: 7rem 0 0;
	}
	.block-head h2,
	.ai h2,
	.contact h2 {
		margin-top: 0.55rem;
		font-size: clamp(2.1rem, 3.4vw, 3rem);
	}
	.cards {
		display: grid;
		gap: 1.1rem;
		margin-top: 2.4rem;
	}
	.card {
		padding: 1.7rem 1.6rem 1.8rem;
		transition:
			transform 0.22s var(--ease),
			border-color 0.22s ease;
	}
	.card:hover {
		transform: translateY(-6px);
		border-color: var(--fg);
	}
	.card-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 2.2rem;
	}
	.card-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.8rem;
		height: 2.8rem;
		border-radius: 12px;
		background: var(--surface-2);
	}
	.card-index {
		color: var(--fg-faint);
		font-size: 0.85rem;
		font-weight: 700;
		letter-spacing: 0.08em;
	}
	.card h3 {
		font-size: 1.35rem;
	}
	.card p {
		margin-top: 0.5rem;
		color: var(--fg-muted);
	}

	.ai {
		display: grid;
		gap: 2.5rem;
		align-items: center;
		margin-top: 2.2rem;
		padding: 2rem;
	}
	.ticks {
		display: grid;
		gap: 0.7rem;
		margin-top: 1.3rem;
	}
	.ticks li {
		display: flex;
		gap: 0.6rem;
		align-items: center;
		font-weight: 600;
	}
	.chat {
		display: grid;
		gap: 0.7rem;
		padding: 1.2rem;
		border: 1px solid var(--line);
		border-radius: var(--r-xl);
		background: var(--surface);
	}
	.bubble {
		max-width: 90%;
		padding: 0.8rem 1rem;
		border-radius: var(--r-lg);
		background: var(--surface-2);
		animation: rise 0.45s var(--ease) both;
	}
	.bubble:nth-child(2) {
		animation-delay: 0.35s;
	}
	.bubble:nth-child(3) {
		animation-delay: 0.7s;
	}
	.bubble:nth-child(4) {
		animation-delay: 1.05s;
	}
	.bubble.me {
		justify-self: end;
		background: var(--fg);
		color: var(--bg);
	}

	.prices {
		display: grid;
		gap: 1rem;
		margin-top: 1.8rem;
	}
	.price {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.6rem;
	}
	.price.featured {
		border-color: var(--fg);
		background: var(--surface-2);
	}
	.mark {
		align-self: flex-start;
		padding: 0.25rem 0.7rem;
		border-radius: 999px;
		background: var(--fg);
		color: var(--bg);
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.amount {
		font-size: 3rem;
		font-weight: 700;
		letter-spacing: -0.04em;
		line-height: 1;
	}
	.amount span {
		font-size: 1rem;
		font-weight: 600;
		letter-spacing: 0;
		color: var(--fg-muted);
	}
	.price ul {
		display: grid;
		flex: 1;
		gap: 0.75rem;
	}
	.price li {
		display: flex;
		gap: 0.6rem;
		align-items: flex-start;
	}

	.faq {
		display: grid;
		gap: 0.7rem;
		margin-top: 1.5rem;
	}
	.faq-item button {
		display: flex;
		width: 100%;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 1.1rem 1.2rem;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		font-weight: 700;
		text-align: left;
		cursor: pointer;
	}
	.chev {
		display: flex;
		flex-shrink: 0;
		transition: transform 0.2s var(--ease);
	}
	.chev.open {
		transform: rotate(180deg);
	}
	.faq-item p {
		padding: 0 1.2rem 1.15rem;
		color: var(--fg-muted);
		animation: fade 0.25s ease both;
	}

	.contact {
		display: grid;
		gap: 2.2rem;
		margin-top: 2rem;
		padding: 2rem;
	}
	.contact form {
		display: grid;
		gap: 0.35rem;
	}
	.contact .btn {
		margin-top: 0.8rem;
		justify-self: start;
	}

	footer {
		display: flex;
		justify-content: space-between;
		padding: 4.5rem 0 2.5rem;
		color: var(--fg-faint);
	}
	footer a {
		font-weight: 700;
		color: var(--fg);
		text-decoration: none;
	}

	.reveal {
		opacity: 0;
		transform: translateY(18px);
	}
	@keyframes float {
		0%,
		100% {
			transform: translateY(0);
		}
		50% {
			transform: translateY(-10px);
		}
	}

	@media (min-width: 760px) {
		.shell {
			width: min(72rem, calc(100% - 3.5rem));
		}
		.nav > .btn {
			margin-left: 0;
		}
		.hero {
			grid-template-columns: 1.05fr 0.95fr;
			width: min(72rem, calc(100% - 3.5rem));
			padding-top: 8rem;
			padding-bottom: 4rem;
		}
		.block {
			width: min(72rem, calc(100% - 3.5rem));
		}
		.cards,
		.prices,
		.ai,
		.contact {
			grid-template-columns: 1fr 1fr;
		}
		.ai,
		.contact {
			padding: 2.6rem;
		}
	}

	@media (min-width: 980px) {
		.nav nav {
			display: flex;
		}
	}

	@media (hover: hover) and (pointer: fine) {
		.landing :global(a),
		.landing :global(button) {
			cursor: var(--cursor-hot);
		}
		.landing :global(input),
		.landing :global(textarea) {
			cursor: text;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.mock,
		.float-card,
		.hero-copy h1,
		.hero-copy .lead,
		.hero-actions,
		.stage,
		.bubble {
			animation: none;
		}
		.reveal {
			opacity: 1;
			transform: none;
		}
		.card:hover {
			transform: none;
		}
		.landing,
		.landing :global(a),
		.landing :global(button) {
			cursor: auto;
		}
	}
</style>

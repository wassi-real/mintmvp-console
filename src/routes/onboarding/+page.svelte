<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import Avatar from '#lib/components/Avatar.svelte';
	import {
		AVATAR_MAX_BYTES,
		AVATAR_TYPES,
		PERSONAS,
		REFERRAL_SOURCES,
		USE_CASES,
		role as roleOption
	} from '#lib/constants.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	// Starting values for the inputs; later edits belong to the person typing.
	const initial = untrack(() => data);

	type StepKey = 'profile' | 'about' | 'workspace';
	const steps = $derived<{ key: StepKey; title: string }[]>([
		...(!data.profileDone
			? [
					{ key: 'profile' as const, title: 'Your profile' },
					{ key: 'about' as const, title: 'About you' }
				]
			: []),
		...(!data.hasWorkspace ? [{ key: 'workspace' as const, title: 'Your workspace' }] : [])
	]);

	let index = $state(0);
	let pending = $state(false);
	// Until the page is interactive, every step is shown so the form still works without JavaScript.
	let interactive = $state(false);
	$effect(() => {
		interactive = true;
	});

	const current = $derived(steps[Math.min(index, steps.length - 1)]?.key);
	const isLast = $derived(index >= steps.length - 1);
	const errors = $derived((form?.errors ?? {}) as Record<string, string>);

	// When the server rejects an answer, jump to the step that contains it.
	$effect(() => {
		if (!form?.step) return;
		const key: StepKey = form.step === 1 ? 'profile' : form.step === 2 ? 'about' : 'workspace';
		const target = steps.findIndex((step) => step.key === key);
		if (target >= 0) index = target;
	});

	// ── Profile step ──
	let fullName = $state(initial.profile.fullName);
	let username = $state(initial.profile.username);
	let bio = $state(initial.profile.bio);
	let avatarPreview = $state<string | null>(initial.profile.avatarUrl);
	let avatarError = $state('');
	let usernameState = $state<{ status: 'idle' | 'checking' | 'ok' | 'bad'; message: string }>({
		status: 'idle',
		message: ''
	});

	let checkTimer: ReturnType<typeof setTimeout> | undefined;
	let checkCounter = 0;

	function onUsernameInput() {
		username = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
		clearTimeout(checkTimer);
		if (username.length < 3) {
			usernameState = { status: 'idle', message: '' };
			return;
		}
		usernameState = { status: 'checking', message: 'Checking…' };
		const ticket = ++checkCounter;
		checkTimer = setTimeout(async () => {
			try {
				const response = await fetch(`/api/username?value=${encodeURIComponent(username)}`);
				const result = (await response.json()) as { available: boolean; message: string };
				if (ticket !== checkCounter) return;
				usernameState = { status: result.available ? 'ok' : 'bad', message: result.message };
			} catch {
				if (ticket === checkCounter) usernameState = { status: 'idle', message: '' };
			}
		}, 350);
	}

	function onAvatarChange(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		avatarError = '';
		if (!file) return;
		if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) {
			avatarError = 'Choose a PNG, JPG, WebP or GIF image.';
		} else if (file.size > AVATAR_MAX_BYTES) {
			avatarError = 'Choose an image smaller than 2 MB.';
		}
		if (avatarError) {
			input.value = '';
			return;
		}
		avatarPreview = URL.createObjectURL(file);
	}

	// ── About step ──
	let persona = $state(initial.answers?.persona ?? '');
	let useCases = $state<string[]>(initial.answers?.useCases ?? []);
	let referralSource = $state(initial.answers?.referralSource ?? '');
	let aboutError = $state('');

	// ── Workspace step ──
	let workspaceChoice = $state(initial.invites[0]?.id ?? 'new');
	let workspaceName = $state('');

	let formElement = $state<HTMLFormElement>();

	/** Checks the visible step with the browser's own validation before moving on. */
	function stepIsValid(): boolean {
		const section = formElement?.querySelector<HTMLElement>(`[data-step="${current}"]`);
		if (!section) return true;
		for (const control of section.querySelectorAll<HTMLInputElement>('input, select, textarea')) {
			if (!control.checkValidity()) {
				control.reportValidity();
				return false;
			}
		}
		if (current === 'profile' && usernameState.status === 'bad') return false;
		if (current === 'about') {
			aboutError = useCases.length === 0 ? 'Choose at least one way you want to use MintMVP Console.' : '';
			if (aboutError) return false;
		}
		return true;
	}

	function next() {
		if (stepIsValid()) index = Math.min(index + 1, steps.length - 1);
	}
</script>

<svelte:head>
	<title>Set up your account · MintMVP Console</title>
</svelte:head>

<main class="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-4 py-10 sm:py-14">
	<div class="flex items-center justify-between gap-4">
		<div class="flex items-center gap-3">
			<img src="/logo-64.png" alt="" width="48" height="48" class="size-12 rounded-block" />
			<span class="text-xl font-bold tracking-tight">MintMVP Console</span>
		</div>
		<form method="POST" action="/auth/logout">
			<button type="submit" class="btn btn-ghost btn-sm">Log out</button>
		</form>
	</div>

	<h1 class="mt-10 animate-rise text-4xl">
		{data.profileDone ? 'Choose a workspace' : 'Let’s set up your account'}
	</h1>
	<p class="mt-3 animate-rise text-lg text-muted">
		{#if data.profileDone}
			You are not in a workspace right now. Join one you were invited to, or create your own.
		{:else}
			A few quick questions, then you are in. Signed in as {data.profile.email}.
		{/if}
	</p>

	{#if steps.length > 1}
		<ol class="mt-8 grid gap-3" style="grid-template-columns: repeat({steps.length}, minmax(0, 1fr))">
			{#each steps as step, i (step.key)}
				<li
					class="rounded-t-sm border-t-[5px] pt-3 text-[0.95rem] transition-colors duration-300 {i <= index
						? 'border-fg font-semibold text-fg'
						: 'border-line text-muted'}"
					aria-current={i === index ? 'step' : undefined}
				>
					Step {i + 1}: {step.title}
				</li>
			{/each}
		</ol>
	{/if}

	{#if form?.message}
		<p class="notice notice-bad mt-6" role="alert">{form.message}</p>
	{/if}

	<form
		bind:this={formElement}
		method="POST"
		enctype="multipart/form-data"
		class="mt-8 grid gap-6"
		use:enhance={({ cancel }) => {
			if (!stepIsValid()) {
				cancel();
				return;
			}
			pending = true;
			return async ({ update }) => {
				await update({ reset: false });
				pending = false;
			};
		}}
	>
		{#if !data.profileDone}
			<!-- Step: profile -->
			<section
				data-step="profile"
				class="panel animate-rise p-6 sm:p-9"
				hidden={interactive && current !== 'profile'}
			>
				<h2 class="text-2xl">Your profile</h2>
				<p class="mt-2 text-muted">This is how other people in your workspace will see you.</p>

				<div class="mt-7 grid gap-6">
					<div class="flex flex-wrap items-center gap-4">
						<Avatar name={fullName || data.profile.email} src={avatarPreview} size={88} />
						<div class="min-w-0 flex-1">
							<label class="label" for="avatar">
								Profile picture <span class="font-normal text-muted">(optional)</span>
							</label>
							<input
								id="avatar"
								name="avatar"
								type="file"
								accept={AVATAR_TYPES.join(',')}
								class="block w-full text-[0.9375rem] text-muted file:mr-4 file:min-h-11 file:cursor-pointer file:rounded-block file:border-0 file:bg-surface-2 file:px-5 file:font-semibold file:text-fg hover:file:bg-surface-3"
								onchange={onAvatarChange}
								aria-describedby="avatar-help"
							/>
							<p id="avatar-help" class={avatarError || errors.avatar ? 'field-error' : 'hint'}>
								{avatarError || errors.avatar || 'PNG, JPG, WebP or GIF. 2 MB at most.'}
							</p>
						</div>
					</div>

					<div>
						<label class="label" for="full_name">Your name</label>
						<input
							id="full_name"
							name="full_name"
							class="input"
							autocomplete="name"
							required
							minlength="2"
							maxlength="80"
							bind:value={fullName}
							aria-invalid={errors.full_name ? 'true' : undefined}
						/>
						{#if errors.full_name}<p class="field-error">{errors.full_name}</p>{/if}
					</div>

					<div>
						<label class="label" for="username">Username</label>
						<div class="flex gap-2">
							<span
								class="flex min-h-12 items-center rounded-block bg-surface-2 px-4 font-semibold text-muted"
								aria-hidden="true">@</span
							>
							<input
								id="username"
								name="username"
								class="input"
								autocomplete="username"
								autocapitalize="none"
								spellcheck="false"
								required
								minlength="3"
								maxlength="24"
								pattern="[a-z0-9_]+"
								bind:value={username}
								oninput={onUsernameInput}
								aria-invalid={errors.username || usernameState.status === 'bad' ? 'true' : undefined}
								aria-describedby="username-help"
							/>
						</div>
						<p
							id="username-help"
							class={errors.username || usernameState.status === 'bad' ? 'field-error' : 'hint'}
							aria-live="polite"
						>
							{#if errors.username}
								{errors.username}
							{:else if usernameState.message}
								<span class={usernameState.status === 'ok' ? 'font-semibold text-ok' : ''}>
									{usernameState.message}
								</span>
							{:else}
								3 to 24 characters: lowercase letters, numbers and underscores. Nobody else can have
								the same one.
							{/if}
						</p>
					</div>

					<div>
						<label class="label" for="bio">
							About you <span class="font-normal text-muted">(optional)</span>
						</label>
						<textarea
							id="bio"
							name="bio"
							class="textarea"
							rows="3"
							maxlength="500"
							placeholder="For example: I run a small studio that builds web apps for clients."
							bind:value={bio}
							aria-describedby="bio-help"
						></textarea>
						<p id="bio-help" class={errors.bio ? 'field-error' : 'hint'}>
							{errors.bio || `${bio.length} of 500 characters`}
						</p>
					</div>
				</div>
			</section>

			<!-- Step: about -->
			<section data-step="about" class="panel animate-rise p-6 sm:p-9" hidden={interactive && current !== 'about'}>
				<h2 class="text-2xl">About you</h2>
				<p class="mt-2 text-muted">Your answers help us make MintMVP Console better. Only you can see them.</p>

				<fieldset class="mt-7">
					<legend class="label">What best describes you?</legend>
					<div class="grid gap-3 sm:grid-cols-2">
						{#each PERSONAS as option (option.value)}
							<label
								class="choice"
							>
								<input
									type="radio"
									name="persona"
									value={option.value}
									class="checkbox"
									required
									bind:group={persona}
								/>
								{option.label}
							</label>
						{/each}
					</div>
					{#if errors.persona}<p class="field-error">{errors.persona}</p>{/if}
				</fieldset>

				<fieldset class="mt-8">
					<legend class="label">How do you want to use MintMVP Console?</legend>
					<p class="hint mt-0 mb-2">Choose everything that applies.</p>
					<div class="grid gap-3 sm:grid-cols-2">
						{#each USE_CASES as option (option.value)}
							<label
								class="choice"
							>
								<input
									type="checkbox"
									name="use_cases"
									value={option.value}
									class="checkbox"
									bind:group={useCases}
								/>
								{option.label}
							</label>
						{/each}
					</div>
					{#if aboutError || errors.use_cases}
						<p class="field-error" role="alert">{aboutError || errors.use_cases}</p>
					{/if}
				</fieldset>

				<div class="mt-8 grid gap-5 sm:grid-cols-2">
					<div>
						<label class="label" for="referral_source">Where did you find us?</label>
						<select
							id="referral_source"
							name="referral_source"
							class="select"
							required
							bind:value={referralSource}
							aria-invalid={errors.referral_source ? 'true' : undefined}
						>
							<option value="" disabled>Choose one</option>
							{#each REFERRAL_SOURCES as option (option.value)}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
						{#if errors.referral_source}<p class="field-error">{errors.referral_source}</p>{/if}
					</div>
					<div>
						<label class="label" for="referral_detail">
							Anything to add? <span class="font-normal text-muted">(optional)</span>
						</label>
						<input
							id="referral_detail"
							name="referral_detail"
							class="input"
							maxlength="200"
							placeholder="For example: a friend's name or a video"
							value={data.answers?.referralDetail ?? ''}
						/>
						{#if errors.referral_detail}<p class="field-error">{errors.referral_detail}</p>{/if}
					</div>
				</div>
			</section>
		{/if}

		{#if !data.hasWorkspace}
			<!-- Step: workspace -->
			<section
				data-step="workspace"
				class="panel animate-rise p-6 sm:p-9"
				hidden={interactive && current !== 'workspace'}
			>
				<h2 class="text-2xl">Your workspace</h2>
				<p class="mt-2 text-muted">
					A workspace holds your projects and the people who work on them. You can invite others
					later.
				</p>

				<fieldset class="mt-7 grid gap-3">
					<legend class="sr-only">Join or create a workspace</legend>

					{#each data.invites as invite (invite.id)}
						<label
							class="choice"
						>
							<input
								type="radio"
								name="workspace_choice"
								value={invite.id}
								class="checkbox"
								bind:group={workspaceChoice}
							/>
							<span>
								<span class="font-semibold">Join {invite.organization_name}</span>
								<span class="block text-[0.9375rem] text-muted">
									{invite.invited_by_name ? `${invite.invited_by_name} invited you` : 'You were invited'}
									as {roleOption(invite.role).label}.
								</span>
							</span>
						</label>
					{/each}

					<label
						class={data.invites.length === 0 ? 'sr-only' : 'choice'}
					>
						<input
							type="radio"
							name="workspace_choice"
							value="new"
							class="checkbox"
							bind:group={workspaceChoice}
						/>
						<span class="font-semibold">Create a new workspace</span>
					</label>
					{#if errors.workspace_choice}<p class="field-error">{errors.workspace_choice}</p>{/if}
				</fieldset>

				{#if workspaceChoice === 'new'}
					<div class="mt-7">
						<label class="label" for="workspace_name">Workspace name</label>
						<input
							id="workspace_name"
							name="workspace_name"
							class="input"
							required
							minlength="2"
							maxlength="80"
							placeholder="For example: Acme Studio"
							bind:value={workspaceName}
							aria-invalid={errors.workspace_name ? 'true' : undefined}
							aria-describedby="workspace-help"
						/>
						<p id="workspace-help" class={errors.workspace_name ? 'field-error' : 'hint'}>
							{errors.workspace_name || 'Usually your company or team name. You can change it later.'}
						</p>
					</div>
				{/if}
			</section>
		{/if}

		<div class="mt-2 flex flex-wrap items-center justify-between gap-3">
			<div>
				{#if interactive && index > 0}
					<button type="button" class="btn btn-lg" onclick={() => (index -= 1)}>Back</button>
				{/if}
			</div>
			{#if interactive && !isLast}
				<button type="button" class="btn btn-primary btn-lg" onclick={next}>Continue</button>
			{:else}
				<button type="submit" class="btn btn-primary btn-lg" disabled={pending}>
					{pending ? 'Saving…' : 'Finish and open dashboard'}
				</button>
			{/if}
		</div>
	</form>
</main>

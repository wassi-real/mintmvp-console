<script lang="ts">
	import Avatar from '#lib/components/Avatar.svelte';
	import Form from '#lib/components/Form.svelte';
	import PageHeader from '#lib/components/PageHeader.svelte';
	import { AVATAR_MAX_BYTES, AVATAR_TYPES, PASSWORD_MIN } from '#lib/constants.ts';
	import { formatDate } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let fullName = $state('');
	let bio = $state('');
	let preview = $state<string | null>(null);
	let avatarError = $state('');
	let removeAvatar = $state(false);

	$effect(() => {
		fullName = data.profile.fullName;
		bio = data.profile.bio;
		preview = data.profile.avatarUrl;
		removeAvatar = false;
	});

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
		removeAvatar = false;
		preview = URL.createObjectURL(file);
	}
</script>

<svelte:head>
	<title>Your account · MintMVP Console</title>
</svelte:head>

<PageHeader title="Your account" description="Your profile is the same in every workspace." />

<div class="grid max-w-3xl gap-8">
	<section class="panel">
		<header class="panel-header"><h2 class="panel-title">Profile</h2></header>
		<div class="panel-body">
			<Form action="?/profile" enctype="multipart/form-data" reset={false}>
				{#snippet children({ pending, errors })}
					<div class="grid gap-6">
						<div class="flex flex-wrap items-center gap-5">
							<Avatar name={fullName || data.profile.email} src={removeAvatar ? null : preview} size={96} />
							<div class="min-w-0 flex-1">
								<label class="label" for="avatar">Profile picture</label>
								<input
									id="avatar"
									name="avatar"
									type="file"
									accept={AVATAR_TYPES.join(',')}
									class="block w-full text-[0.95rem] text-muted file:mr-4 file:min-h-11 file:cursor-pointer file:rounded-block file:border-0 file:bg-surface-2 file:px-5 file:font-semibold file:text-fg hover:file:bg-surface-3"
									onchange={onAvatarChange}
								/>
								<p class={avatarError || errors.avatar ? 'field-error' : 'hint'}>
									{avatarError || errors.avatar || 'PNG, JPG, WebP or GIF. 2 MB at most.'}
								</p>
								{#if data.profile.avatarUrl}
									<label class="mt-3 flex items-center gap-3 text-[0.95rem]">
										<input type="checkbox" name="remove_avatar" class="checkbox" bind:checked={removeAvatar} />
										Remove my current picture
									</label>
								{/if}
							</div>
						</div>

						<div class="grid gap-5 sm:grid-cols-2">
							<div>
								<label class="label" for="full_name">Your name</label>
								<input
									id="full_name"
									name="full_name"
									class="input"
									required
									minlength="2"
									maxlength="80"
									autocomplete="name"
									bind:value={fullName}
									aria-invalid={errors.full_name ? 'true' : undefined}
								/>
								{#if errors.full_name}<p class="field-error">{errors.full_name}</p>{/if}
							</div>
							<div>
								<label class="label" for="username">Username</label>
								<input
									id="username"
									name="username"
									class="input"
									required
									minlength="3"
									maxlength="24"
									pattern="[a-z0-9_]+"
									autocapitalize="none"
									spellcheck="false"
									value={data.profile.username}
									aria-invalid={errors.username ? 'true' : undefined}
								/>
								<p class={errors.username ? 'field-error' : 'hint'}>
									{errors.username || 'Lowercase letters, numbers and underscores.'}
								</p>
							</div>
						</div>

						<div>
							<label class="label" for="bio">About you</label>
							<textarea id="bio" name="bio" class="textarea" rows="3" maxlength="500" bind:value={bio}
							></textarea>
							<p class={errors.bio ? 'field-error' : 'hint'}>
								{errors.bio || `${bio.length} of 500 characters`}
							</p>
						</div>
					</div>
					<div class="mt-7 flex justify-end">
						<button type="submit" class="btn btn-primary" disabled={pending}>
							{pending ? 'Saving…' : 'Save profile'}
						</button>
					</div>
				{/snippet}
			</Form>
		</div>
	</section>

	<section class="panel">
		<header class="panel-header"><h2 class="panel-title">Sign-in details</h2></header>
		<div class="panel-body">
			<dl class="mb-7 grid gap-3 sm:grid-cols-2">
				<div class="rounded-block bg-surface-2 p-4">
					<dt class="eyebrow">Email address</dt>
					<dd class="mt-1.5 font-semibold break-all">{data.profile.email}</dd>
				</div>
				<div class="rounded-block bg-surface-2 p-4">
					<dt class="eyebrow">Member since</dt>
					<dd class="mt-1.5 font-semibold">{formatDate(data.profile.joined)}</dd>
				</div>
			</dl>

			<Form action="?/password">
				{#snippet children({ pending, errors })}
					<h3 class="mb-4 text-lg">Change your password</h3>
					<div class="grid gap-5 sm:grid-cols-2">
						<div>
							<label class="label" for="password">New password</label>
							<input
								id="password"
								name="password"
								type="password"
								class="input"
								required
								minlength={PASSWORD_MIN}
								maxlength="72"
								autocomplete="new-password"
								aria-invalid={errors.password ? 'true' : undefined}
							/>
							<p class={errors.password ? 'field-error' : 'hint'}>
								{errors.password || `At least ${PASSWORD_MIN} characters.`}
							</p>
						</div>
						<div>
							<label class="label" for="confirm">Type it again</label>
							<input
								id="confirm"
								name="confirm"
								type="password"
								class="input"
								required
								maxlength="72"
								autocomplete="new-password"
								aria-invalid={errors.confirm ? 'true' : undefined}
							/>
							{#if errors.confirm}<p class="field-error">{errors.confirm}</p>{/if}
						</div>
					</div>
					<div class="mt-7 flex justify-end">
						<button type="submit" class="btn" disabled={pending}>
							{pending ? 'Changing…' : 'Change password'}
						</button>
					</div>
				{/snippet}
			</Form>
		</div>
	</section>

	<section class="panel">
		<div class="panel-body flex flex-wrap items-center justify-between gap-4">
			<div>
				<h2 class="text-lg">Log out</h2>
				<p class="text-muted">End your session on this device.</p>
			</div>
			<form method="POST" action="/auth/logout">
				<button type="submit" class="btn">Log out</button>
			</form>
		</div>
	</section>
</div>

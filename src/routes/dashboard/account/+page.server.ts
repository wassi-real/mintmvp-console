import { fail } from '@sveltejs/kit';
import { PASSWORD_MIN } from '#lib/constants.ts';
import { authMessage } from '#lib/server/auth.ts';
import { workspaceContext } from '#lib/server/context.ts';
import { avatarProblem, normalizeUsername, uploadAvatar, usernameProblem } from '#lib/server/profile.ts';
import { text } from '#lib/server/validate.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = (event) => {
	const { profile } = workspaceContext(event);
	return {
		profile: {
			fullName: profile.full_name,
			username: profile.username ?? '',
			bio: profile.bio,
			avatarUrl: profile.avatar_url,
			email: profile.email,
			joined: profile.created_at
		}
	};
};

export const actions: Actions = {
	profile: async (event) => {
		const { supabase, profile } = workspaceContext(event);
		const form = await event.request.formData();

		const fullName = text(form, 'full_name');
		const username = normalizeUsername(text(form, 'username'));
		const bio = text(form, 'bio');
		const avatar = form.get('avatar');
		const avatarFile = avatar instanceof File && avatar.size > 0 ? avatar : null;
		const removeAvatar = text(form, 'remove_avatar') === 'on';

		const errors: Record<string, string> = {};
		if (fullName.length < 2 || fullName.length > 80) {
			errors.full_name = 'Enter your name (2 to 80 characters).';
		}
		const problem = usernameProblem(username);
		if (problem) errors.username = problem;
		if (bio.length > 500) errors.bio = 'Keep this to 500 characters or fewer.';
		if (avatarFile) {
			const pictureProblem = avatarProblem(avatarFile);
			if (pictureProblem) errors.avatar = pictureProblem;
		}
		if (Object.keys(errors).length) {
			return fail(400, { message: 'Please fix the highlighted fields.', errors });
		}

		let avatarUrl = removeAvatar ? null : profile.avatar_url;
		if (avatarFile) {
			const upload = await uploadAvatar(supabase, profile.id, avatarFile);
			if ('error' in upload) {
				return fail(400, {
					message: 'Please fix the highlighted fields.',
					errors: { avatar: upload.error }
				});
			}
			avatarUrl = upload.url;
		}

		const { error } = await supabase
			.from('users')
			.update({ full_name: fullName, username, bio, avatar_url: avatarUrl })
			.eq('id', profile.id);

		if (error?.code === '23505') {
			return fail(400, {
				message: 'Please fix the highlighted fields.',
				errors: { username: 'That username is already taken. Choose another one.' }
			});
		}
		if (error) {
			console.error('profile update failed:', error.message);
			return fail(500, { message: 'We could not save your profile. Please try again.' });
		}
		return { message: 'Profile saved.' };
	},

	password: async (event) => {
		const { supabase } = workspaceContext(event);
		const form = await event.request.formData();
		const password = String(form.get('password') ?? '');
		const confirm = String(form.get('confirm') ?? '');

		const errors: Record<string, string> = {};
		if (password.length < PASSWORD_MIN) {
			errors.password = `Use at least ${PASSWORD_MIN} characters.`;
		} else if (password.length > 72) {
			errors.password = 'Use 72 characters or fewer.';
		}
		if (!errors.password && password !== confirm) errors.confirm = 'The two passwords do not match.';
		if (Object.keys(errors).length) {
			return fail(400, { message: 'Please fix the highlighted fields.', errors });
		}

		const { error } = await supabase.auth.updateUser({ password });
		if (error) return fail(400, { message: authMessage(error) });
		return { message: 'Password changed.' };
	}
};

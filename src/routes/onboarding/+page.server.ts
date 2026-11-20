import { error, fail, redirect } from '@sveltejs/kit';
import { PERSONAS, REFERRAL_SOURCES, USE_CASES } from '#lib/constants.ts';
import { normalizeUsername, uploadAvatar, usernameProblem, avatarProblem } from '#lib/server/profile.ts';
import { isUuid, text } from '#lib/server/validate.ts';
import type { Actions, PageServerLoad } from './$types';

// The server hook guarantees a signed-in user here and sends anyone who has already finished
// onboarding (and has a workspace) on to the dashboard.
export const load: PageServerLoad = async ({ locals }) => {
	const profile = locals.profile;
	if (!profile) error(401, 'Please sign in again.');

	const [{ data: invites }, { data: answers }] = await Promise.all([
		locals.supabase.rpc('my_pending_invites'),
		locals.supabase.from('user_onboarding').select('*').eq('user_id', profile.id).maybeSingle()
	]);

	return {
		profile: {
			email: profile.email,
			fullName: profile.full_name,
			username: profile.username ?? '',
			bio: profile.bio,
			avatarUrl: profile.avatar_url
		},
		answers: answers
			? {
					persona: answers.persona,
					useCases: answers.use_cases,
					referralSource: answers.referral_source,
					referralDetail: answers.referral_detail
				}
			: null,
		invites: invites ?? [],
		/** Already answered the questions before (for example, removed from a workspace later). */
		profileDone: Boolean(profile.onboarded_at),
		hasWorkspace: Boolean(profile.organization_id)
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const profile = locals.profile;
		if (!profile) return fail(401, { message: 'Please sign in again.', errors: {}, step: 1 });

		const supabase = locals.supabase;
		const form = await request.formData();
		const errors: Record<string, string> = {};
		const profileDone = Boolean(profile.onboarded_at);
		const needsWorkspace = !profile.organization_id;

		// ── Read and validate everything before changing anything ──
		const fullName = text(form, 'full_name');
		const username = normalizeUsername(text(form, 'username'));
		const bio = text(form, 'bio');
		const avatar = form.get('avatar');
		const avatarFile = avatar instanceof File && avatar.size > 0 ? avatar : null;

		const persona = text(form, 'persona');
		const useCases = [...new Set(form.getAll('use_cases').map(String))];
		const referralSource = text(form, 'referral_source');
		const referralDetail = text(form, 'referral_detail');

		const workspaceChoice = text(form, 'workspace_choice');
		const workspaceName = text(form, 'workspace_name');

		if (!profileDone) {
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

			if (!PERSONAS.some((option) => option.value === persona)) {
				errors.persona = 'Choose the option that fits you best.';
			}
			if (useCases.length === 0) {
				errors.use_cases = 'Choose at least one.';
			} else if (useCases.some((value) => !USE_CASES.some((option) => option.value === value))) {
				errors.use_cases = 'Choose from the list.';
			}
			if (!REFERRAL_SOURCES.some((option) => option.value === referralSource)) {
				errors.referral_source = 'Tell us where you found us.';
			}
			if (referralDetail.length > 200) {
				errors.referral_detail = 'Keep this to 200 characters or fewer.';
			}
		}

		if (needsWorkspace) {
			if (workspaceChoice === 'new' || workspaceChoice === '') {
				if (workspaceName.length < 2 || workspaceName.length > 80) {
					errors.workspace_name = 'Give your workspace a name (2 to 80 characters).';
				}
			} else if (!isUuid(workspaceChoice)) {
				errors.workspace_choice = 'Choose a workspace to join, or create a new one.';
			}
		}

		const step = errors.full_name || errors.username || errors.bio || errors.avatar
			? 1
			: errors.persona || errors.use_cases || errors.referral_source || errors.referral_detail
				? 2
				: 3;

		if (Object.keys(errors).length > 0) {
			return fail(400, { message: 'Please fix the highlighted answers.', errors, step });
		}

		// ── Profile ──
		if (!profileDone) {
			const { error: profileError } = await supabase
				.from('users')
				.update({ full_name: fullName, username, bio })
				.eq('id', profile.id);

			if (profileError?.code === '23505') {
				return fail(400, {
					message: 'Please fix the highlighted answers.',
					errors: { username: 'That username is already taken. Choose another one.' },
					step: 1
				});
			}
			if (profileError) {
				console.error('onboarding profile update failed:', profileError.message);
				return fail(500, { message: 'We could not save your profile. Please try again.', errors, step: 1 });
			}

			if (avatarFile) {
				const upload = await uploadAvatar(supabase, profile.id, avatarFile);
				if ('error' in upload) {
					return fail(400, {
						message: 'Please fix the highlighted answers.',
						errors: { avatar: upload.error },
						step: 1
					});
				}
				await supabase.from('users').update({ avatar_url: upload.url }).eq('id', profile.id);
			}

			const { error: answersError } = await supabase.from('user_onboarding').upsert(
				{
					user_id: profile.id,
					persona,
					use_cases: useCases,
					referral_source: referralSource,
					referral_detail: referralDetail,
					completed_at: new Date().toISOString()
				},
				{ onConflict: 'user_id' }
			);
			if (answersError) {
				console.error('onboarding answers failed:', answersError.message);
				return fail(500, { message: 'We could not save your answers. Please try again.', errors, step: 2 });
			}
		}

		// ── Workspace ──
		if (needsWorkspace) {
			const result =
				workspaceChoice && workspaceChoice !== 'new'
					? await supabase.rpc('accept_invite', { p_invite_id: workspaceChoice })
					: await supabase.rpc('create_workspace', { p_name: workspaceName });

			if (result.error) {
				console.error('onboarding workspace step failed:', result.error.message);
				return fail(400, {
					message:
						workspaceChoice && workspaceChoice !== 'new'
							? 'That invitation is no longer valid. Create your own workspace instead, or ask for a new invitation.'
							: 'We could not create your workspace. Please try again.',
					errors,
					step: 3
				});
			}
		}

		// ── Done ──
		if (!profileDone) {
			const { error: doneError } = await supabase
				.from('users')
				.update({ onboarded_at: new Date().toISOString() })
				.eq('id', profile.id);
			if (doneError) {
				console.error('onboarding completion failed:', doneError.message);
				return fail(500, { message: 'Almost there. Please press Finish again.', errors, step: 3 });
			}
		}

		redirect(303, '/dashboard');
	}
};

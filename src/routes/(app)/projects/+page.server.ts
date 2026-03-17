import type { PageServerLoad, Actions } from './$types';
import type { Tables } from '$lib/supabase/types';
import { fail } from '@sveltejs/kit';
import { logActivity, getActorName } from '$lib/server/activity';

export const load: PageServerLoad = async ({ locals }) => {
	const { supabase } = locals;

	const [projectsRes, deploymentsRes, incidentsRes] = await Promise.all([
		supabase.from('projects').select('*').order('created_at', { ascending: false }),
		supabase.from('deployments').select('*').order('created_at', { ascending: false }),
		supabase.from('incidents').select('*')
	]);

	const projects = (projectsRes.data ?? []) as Tables<'projects'>[];
	const deployments = (deploymentsRes.data ?? []) as Tables<'deployments'>[];
	const incidents = (incidentsRes.data ?? []) as Tables<'incidents'>[];

	const projectList = projects.map((project) => {
		const projectDeploys = deployments.filter((d) => d.project_id === project.id);
		const projectIncidents = incidents.filter((i) => i.project_id === project.id);

		return {
			...project,
			lastDeploy: projectDeploys[0] ?? null,
			openIncidents: projectIncidents.filter((i) => i.status !== 'resolved').length
		};
	});

	return { projects: projectList };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const { supabase, session } = locals;
		const user = session!.user;

		const form = await request.formData();
		const name = (form.get('name') as string)?.trim();
		const repo_url = (form.get('repo_url') as string)?.trim() || null;
		const staging_url = (form.get('staging_url') as string)?.trim() || null;
		const production_url = (form.get('production_url') as string)?.trim() || null;
		const status = (form.get('status') as string) || 'active';

		if (!name) return fail(400, { error: 'Project name is required' });

		// --- Resolve organization_id ---
		let organization_id: string | null = null;

		// 1. Check if this user already has a profile with an org
		const { data: userProfile } = await (supabase.from('users') as any)
			.select('organization_id')
			.eq('id', user.id)
			.single();

		if (userProfile?.organization_id) {
			organization_id = userProfile.organization_id;
		} else {
			// 2. Check if any organization exists at all
			const { data: existingOrg } = await (supabase.from('organizations') as any)
				.select('id')
				.limit(1)
				.single();

			if (existingOrg?.id) {
				organization_id = existingOrg.id;
			} else {
				// 3. Bootstrap: create a default organization
				const domainPart = user.email?.split('@')[1]?.split('.')[0] ?? 'mintmvp';
				const orgName = domainPart.charAt(0).toUpperCase() + domainPart.slice(1);

				const { data: newOrg, error: orgErr } = await (supabase.from('organizations') as any)
					.insert({ name: orgName })
					.select('id')
					.single();

				if (orgErr || !newOrg?.id) {
					return fail(500, { error: `Could not create organization: ${orgErr?.message ?? 'unknown error'}` });
				}
				organization_id = newOrg.id;
			}

			// 4. Ensure the user has a profile row pointing to this org
			await (supabase.from('users') as any).upsert(
				{
					id: user.id,
					email: user.email ?? '',
					full_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? '',
					role: 'owner',
					organization_id
				},
				{ onConflict: 'id' }
			);
		}

		if (!organization_id) {
			return fail(500, { error: 'Could not determine organization. Please refresh and try again.' });
		}

		// --- Create the project ---
		const { error: projectErr } = await (supabase.from('projects') as any).insert({
			organization_id,
			name,
			repo_url,
			staging_url,
			production_url,
			status
		});

		if (projectErr) return fail(500, { error: projectErr.message });

		// Log activity — need the new project id, so query it
		const { data: newProject } = await (supabase.from('projects') as any)
			.select('id')
			.eq('organization_id', organization_id)
			.eq('name', name)
			.order('created_at', { ascending: false })
			.limit(1)
			.single();

		if (newProject?.id) {
			await logActivity(supabase, newProject.id, 'Project created', getActorName(session!), { project: name });
		}

		return { success: true };
	}
};

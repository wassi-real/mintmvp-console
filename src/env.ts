import { defineEnvVars } from '@sveltejs/kit/env';

function required(name: string) {
	return (value: string | undefined) => {
		const trimmed = value?.trim();
		if (!trimmed) throw new Error(`${name} is not set. Add it to your .env file.`);
		return trimmed;
	};
}

function optional(value: string | undefined) {
	return value?.trim() || undefined;
}

export const variables = defineEnvVars({
	PUBLIC_SUPABASE_URL: {
		public: true,
		description: 'URL of the Supabase project, for example https://abc.supabase.co',
		schema: (value) => {
			const url = required('PUBLIC_SUPABASE_URL')(value);
			if (!/^https?:\/\//.test(url)) {
				throw new Error('PUBLIC_SUPABASE_URL must start with http:// or https://');
			}
			return url.replace(/\/+$/, '');
		}
	},
	PUBLIC_SUPABASE_ANON_KEY: {
		public: true,
		description: 'Supabase anon (publishable) key. Safe to expose; row level security applies.',
		schema: required('PUBLIC_SUPABASE_ANON_KEY')
	},
	SUPABASE_SERVICE_ROLE_KEY: {
		description:
			'Supabase service role key. Server only. Bypasses row level security, so it is used only for the public API, public status pages and scheduled jobs.',
		schema: required('SUPABASE_SERVICE_ROLE_KEY')
	},
	APP_ENCRYPTION_KEY: {
		description:
			'Optional. Secret used to encrypt stored integration tokens. When unset, a key is derived from the service role key.',
		schema: optional
	},
	ALLOW_PRIVATE_MONITORING_TARGETS: {
		description:
			'Optional. Set to "true" on self-hosted installs to let uptime checks reach private network addresses.',
		schema: (value) => value?.trim().toLowerCase() === 'true'
	}
});

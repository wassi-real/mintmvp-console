import { enhancedImages } from '@sveltejs/enhanced-img';
import tailwindcss from '@tailwindcss/vite';
import adapter from '@sveltejs/adapter-vercel';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

/** Report markdown uses these packages; Vercel route bundles must include them. */
const MARKDOWN_SSR = [
	'marked',
	'htmlparser2',
	'domelementtype',
	'domhandler',
	'domutils',
	'dom-serializer',
	'entities'
];

export default defineConfig({
	ssr: {
		noExternal: MARKDOWN_SSR
	},
	plugins: [
		enhancedImages(),
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		})
	]
});

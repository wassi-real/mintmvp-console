import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = [
	...sanitizeHtml.defaults.allowedTags,
	'img',
	'h1',
	'h2',
	'del',
	'input',
	'details',
	'summary'
];

/**
 * Turns Markdown written by people or agents into safe HTML. Everything that could run code
 * (scripts, event handlers, javascript: links, styles) is removed.
 */
export function renderMarkdown(source: string): string {
	const html = marked.parse(source, { async: false, gfm: true, breaks: false });
	return sanitizeHtml(html, {
		allowedTags: ALLOWED_TAGS,
		allowedAttributes: {
			a: ['href', 'title'],
			img: ['src', 'alt', 'title', 'width', 'height'],
			input: ['type', 'checked', 'disabled'],
			th: ['align'],
			td: ['align'],
			code: ['class']
		},
		allowedSchemes: ['http', 'https', 'mailto'],
		allowedSchemesByTag: { img: ['http', 'https'] },
		transformTags: {
			a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noreferrer noopener' }),
			// Only task-list checkboxes survive, and they cannot be changed.
			input: (tagName, attribs) => ({
				tagName: attribs.type === 'checkbox' ? 'input' : 'span',
				attribs: attribs.type === 'checkbox' ? { ...attribs, disabled: 'disabled' } : {}
			})
		}
	});
}
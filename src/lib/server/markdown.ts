import { DomHandler, Element, Text, isTag, type ChildNode, type Element as DomElement } from 'domhandler';
import render from 'dom-serializer';
import { Parser } from 'htmlparser2';
import { marked } from 'marked';

const ALLOWED_TAGS = new Set([
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'p',
	'br',
	'hr',
	'ul',
	'ol',
	'li',
	'blockquote',
	'pre',
	'code',
	'em',
	'strong',
	'del',
	'a',
	'img',
	'table',
	'thead',
	'tbody',
	'tr',
	'th',
	'td',
	'details',
	'summary',
	'input'
]);

const GLOBAL_ATTRS = new Set(['class']);
const ALLOWED_ATTRS: Record<string, Set<string>> = {
	a: new Set(['href', 'title']),
	img: new Set(['src', 'alt', 'title', 'width', 'height']),
	input: new Set(['type', 'checked', 'disabled']),
	th: new Set(['align']),
	td: new Set(['align']),
	code: new Set(['class'])
};

const ALLOWED_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

function cleanUrl(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const trimmed = value.trim();
	if (!trimmed || /^javascript:/i.test(trimmed) || /^data:/i.test(trimmed)) return undefined;
	try {
		const url = new URL(trimmed, 'https://example.invalid');
		if (!ALLOWED_SCHEMES.has(url.protocol)) return undefined;
		return trimmed;
	} catch {
		return undefined;
	}
}

function sanitizeElement(node: DomElement): DomElement | null {
	const tag = node.name.toLowerCase();
	if (!ALLOWED_TAGS.has(tag)) return null;

	const allowed = ALLOWED_ATTRS[tag] ?? new Set<string>();
	const attribs: Record<string, string> = {};

	for (const [name, value] of Object.entries(node.attribs ?? {})) {
		const key = name.toLowerCase();
		if (key.startsWith('on') || key === 'style') continue;
		if (!GLOBAL_ATTRS.has(key) && !allowed.has(key)) continue;
		if ((key === 'href' || key === 'src') && cleanUrl(value) === undefined) continue;
		attribs[key] = value;
	}

	if (tag === 'a') {
		attribs.target = '_blank';
		attribs.rel = 'noreferrer noopener';
	}
	if (tag === 'input' && attribs.type !== 'checkbox') return null;
	if (tag === 'input' && attribs.type === 'checkbox') attribs.disabled = 'disabled';

	const children: ChildNode[] = [];
	for (const child of node.children) {
		const cleaned = sanitizeNode(child);
		if (cleaned) children.push(...(Array.isArray(cleaned) ? cleaned : [cleaned]));
	}

	return new Element(tag, attribs, children, node.type);
}

function sanitizeNode(node: ChildNode): ChildNode | ChildNode[] | null {
	if (node.type === 'text') {
		return new Text((node as Text).data);
	}
	if (isTag(node)) {
		return sanitizeElement(node);
	}
	return null;
}

function sanitizeHtml(html: string): string {
	let roots: ChildNode[] = [];
	let parseError: Error | undefined;

	const parser = new Parser(
		new DomHandler((error, nodes) => {
			parseError = error ?? undefined;
			roots = nodes;
		}),
		{ decodeEntities: true }
	);
	parser.write(html);
	parser.end();

	if (parseError) throw parseError;

	const safe: ChildNode[] = [];
	for (const node of roots) {
		const cleaned = sanitizeNode(node);
		if (cleaned) safe.push(...(Array.isArray(cleaned) ? cleaned : [cleaned]));
	}

	return render(safe, { encodeEntities: false, selfClosingTags: true });
}

/**
 * Turns Markdown written by people or agents into safe HTML. Everything that could run code
 * (scripts, event handlers, javascript: links, styles) is removed.
 */
export function renderMarkdown(source: string | null | undefined): string {
	const html = marked.parse(source ?? '', { async: false, gfm: true, breaks: false });
	try {
		return sanitizeHtml(String(html));
	} catch (cause) {
		console.error('sanitize html failed:', cause);
		return '';
	}
}
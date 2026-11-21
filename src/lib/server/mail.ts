import { Resend } from 'resend';
import { RESEND_API_KEY, RESEND_FROM } from '$app/env/private';

let client: Resend | undefined;

function resend(): Resend | null {
	if (!RESEND_API_KEY || !RESEND_FROM) return null;
	client ??= new Resend(RESEND_API_KEY);
	return client;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

export interface Mail {
	to: string;
	subject: string;
	title: string;
	body?: string;
	/** Absolute https URL the button opens. */
	href?: string;
	action?: string;
}

/** Sends one email through Resend. Returns false when Resend is not configured or the send fails. */
export async function sendMail(mail: Mail): Promise<boolean> {
	const api = resend();
	if (!api || !RESEND_FROM) return false;

	const title = escapeHtml(mail.title);
	const body = mail.body ? `<p style="margin:16px 0 0;color:#4d4d4d;">${escapeHtml(mail.body)}</p>` : '';
	const button =
		mail.href && mail.action
			? `<p style="margin:28px 0 0;"><a href="${escapeHtml(mail.href)}" style="display:inline-block;padding:12px 18px;border-radius:12px;background:#0a0a0a;color:#ffffff;font-weight:700;text-decoration:none;">${escapeHtml(mail.action)}</a></p>`
			: '';
	const html = `<div style="font-family:Inter,Segoe UI,sans-serif;font-size:16px;line-height:1.5;color:#0a0a0a;"><p style="margin:0;font-size:18px;font-weight:700;">${title}</p>${body}${button}</div>`;
	const text = [mail.title, mail.body ?? '', mail.href ? `${mail.action ?? 'Open'}: ${mail.href}` : '']
		.filter(Boolean)
		.join('\n\n');

	const { error } = await api.emails.send({
		from: RESEND_FROM,
		to: mail.to,
		subject: mail.subject,
		html,
		text
	});
	if (error) {
		console.error('resend failed:', error.message);
		return false;
	}
	return true;
}

// The prompt people paste into their coding agent. Shown on the Connect agent page and in the docs.

export function agentPrompt(input: { project: string; apiBase: string; docsUrl: string; key?: string }): string {
	const key = input.key || '<paste the key from Mint>';
	return `You are working on the project "${input.project}". Mint Console holds the plans I approved and the record of what happened. Use it as the source of truth.

API: ${input.apiBase}
Send these headers on every request:
  Authorization: Bearer ${key}
  X-Agent-Name: <a short name for yourself, for example claude-code>
Docs: ${input.docsUrl}

How to work:
1. Start with GET /board. "moving" lists work you can pick up. Never start work another agent has claimed.
2. Claim before you start: POST /work/{id}/claim. A 409 means someone else holds it. Pick something else.
3. Build only what the approved plan says. To add scope, POST /work/{id}/scope with "proposal" and "reason", then carry on without building it.
4. Post progress with POST /work/{id}/notes (this renews your claim). If you stop, POST /work/{id}/handoff with "note" and "next_action".
5. When it is done, run the checks and POST /work/{id}/checks with "result" ("passed" or "failed"), "build" and "body".
6. For a new idea, POST /work with "title", "outcome", "plan" and "acceptance". I approve it in Mint.

You cannot approve, accept or drop work. I do that. On a 429, wait the number of seconds in Retry-After.`;
}

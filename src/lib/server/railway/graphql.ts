import { createHash } from 'node:crypto';

const RAILWAY_GQL = 'https://backboard.railway.com/graphql/v2';

/** If Bearer fails once, project-token mode works; cache that so we do not double-hit Railway on every log line. */
const tokenUsesProjectHeader = new Set<string>();

function railwayTokenCacheKey(token: string): string {
	return createHash('sha256').update(token).digest('hex').slice(0, 24);
}

/** Matches `src/gql/queries/strings/Deployments.graphql` in railwayapp/cli */
export const DEPLOYMENTS_QUERY = `
query Deployments($input: DeploymentListInput!, $first: Int) {
  deployments(input: $input, first: $first) {
    edges {
      node {
        id
        createdAt
        status
      }
    }
  }
}
`;

/** Matches `src/gql/queries/strings/DeploymentLogs.graphql` in railwayapp/cli */
export const DEPLOYMENT_LOGS_QUERY = `
query DeploymentLogs($deploymentId: String!, $limit: Int, $filter: String, $startDate: DateTime, $endDate: DateTime) {
  deploymentLogs(deploymentId: $deploymentId, limit: $limit, filter: $filter, startDate: $startDate, endDate: $endDate) {
    timestamp
    message
    attributes {
      key
      value
    }
  }
}
`;

/** Matches `src/gql/queries/strings/BuildLogs.graphql` in railwayapp/cli */
export const BUILD_LOGS_QUERY = `
query BuildLogs($deploymentId: String!, $limit: Int, $startDate: DateTime, $endDate: DateTime, $filter: String) {
  buildLogs(deploymentId: $deploymentId, limit: $limit, startDate: $startDate, endDate: $endDate, filter: $filter) {
    timestamp
    message
    attributes {
      key
      value
    }
  }
}
`;

type GqlError = { message: string };

function buildAuthHeaders(token: string, mode: 'bearer' | 'project'): Record<string, string> {
	const h: Record<string, string> = {
		'Content-Type': 'application/json',
		'User-Agent': 'MintMVP-Console/1.0 (Railway log poller)'
	};
	if (mode === 'bearer') {
		h.Authorization = `Bearer ${token}`;
	} else {
		// Project tokens MUST use this header per https://docs.railway.com/reference/public-api
		h['Project-Access-Token'] = token;
	}
	return h;
}

function parseRailwayResponse(text: string, httpStatus: number): { data?: unknown; errors?: GqlError[] } {
	let body: { data?: unknown; errors?: GqlError[] };
	try {
		body = JSON.parse(text) as { data?: unknown; errors?: GqlError[] };
	} catch {
		throw new Error(`Railway API: invalid JSON (${httpStatus})`);
	}
	return body;
}

async function railwayGraphqlOnce<T>(
	token: string,
	query: string,
	variables: Record<string, unknown>,
	authMode: 'bearer' | 'project'
): Promise<T> {
	const res = await fetch(RAILWAY_GQL, {
		method: 'POST',
		headers: buildAuthHeaders(token, authMode),
		body: JSON.stringify({ query, variables })
	});
	const text = await res.text();
	const body = parseRailwayResponse(text, res.status);

	if (!res.ok) {
		const gqlMsg = body.errors?.map((e) => e.message).join('; ');
		throw new Error(`Railway API HTTP ${res.status}: ${gqlMsg ?? text.slice(0, 200)}`);
	}
	if (body.errors?.length) {
		throw new Error(body.errors.map((e) => e.message).join('; '));
	}
	if (body.data === undefined) {
		throw new Error('Railway API: empty response');
	}
	return body.data as T;
}

function isRailwayAuthFailure(message: string): boolean {
	return /not authorized|unauthorized|401|invalid token|project token not found/i.test(message);
}

/**
 * Railway uses `Authorization: Bearer` for account / workspace / OAuth tokens, and
 * `Project-Access-Token` for environment-scoped project tokens. We try Bearer first, then project header.
 */
export async function railwayGraphql<T>(
	token: string,
	query: string,
	variables: Record<string, unknown>
): Promise<T> {
	const trimmed = token.trim();
	if (!trimmed) {
		throw new Error('Railway API token is empty');
	}

	const ck = railwayTokenCacheKey(trimmed);

	const bearerThenProject = async (): Promise<T> => {
		try {
			return await railwayGraphqlOnce<T>(trimmed, query, variables, 'bearer');
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			if (!isRailwayAuthFailure(msg)) {
				throw e;
			}
			try {
				const data = await railwayGraphqlOnce<T>(trimmed, query, variables, 'project');
				tokenUsesProjectHeader.add(ck);
				return data;
			} catch (e2) {
				const msg2 = e2 instanceof Error ? e2.message : String(e2);
				throw new Error(
					`${msg2} (Railway rejected Bearer auth (${msg}) and Project-Access-Token. ` +
						`Use a personal or workspace token from https://railway.com/account/tokens with Bearer, ` +
						`or a project token from the project’s token settings — project tokens only work with the Project-Access-Token header, which we retry automatically.)`
				);
			}
		}
	};

	if (tokenUsesProjectHeader.has(ck)) {
		try {
			return await railwayGraphqlOnce<T>(trimmed, query, variables, 'project');
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			if (isRailwayAuthFailure(msg)) {
				tokenUsesProjectHeader.delete(ck);
				return await bearerThenProject();
			}
			throw e;
		}
	}

	return await bearerThenProject();
}

export type RailwayDeploymentNode = {
	id: string;
	createdAt: string;
	status: string;
};

export async function listRailwayDeployments(
	token: string,
	input: { projectId: string; environmentId: string; serviceId: string },
	first = 15
): Promise<RailwayDeploymentNode[]> {
	const data = await railwayGraphql<{
		deployments: { edges: { node: RailwayDeploymentNode }[] };
	}>(token, DEPLOYMENTS_QUERY, { input, first });
	const edges = data.deployments?.edges ?? [];
	return edges.map((e) => e.node);
}

export type RailwayLogLine = {
	timestamp: string;
	message: string;
	attributes?: { key: string; value: string }[] | null;
};

export async function fetchDeploymentLogs(
	token: string,
	deploymentId: string,
	opts?: { limit?: number; filter?: string | null; startDate?: string | null; endDate?: string | null }
): Promise<RailwayLogLine[]> {
	const data = await railwayGraphql<{ deploymentLogs: RailwayLogLine[] }>(token, DEPLOYMENT_LOGS_QUERY, {
		deploymentId,
		limit: opts?.limit ?? 400,
		filter: opts?.filter ?? null,
		startDate: opts?.startDate ?? null,
		endDate: opts?.endDate ?? null
	});
	return data.deploymentLogs ?? [];
}

export async function fetchBuildLogs(
	token: string,
	deploymentId: string,
	opts?: { limit?: number; filter?: string | null; startDate?: string | null; endDate?: string | null }
): Promise<RailwayLogLine[]> {
	const data = await railwayGraphql<{ buildLogs: RailwayLogLine[] }>(token, BUILD_LOGS_QUERY, {
		deploymentId,
		limit: opts?.limit ?? 400,
		startDate: opts?.startDate ?? null,
		endDate: opts?.endDate ?? null,
		filter: opts?.filter ?? null
	});
	return data.buildLogs ?? [];
}

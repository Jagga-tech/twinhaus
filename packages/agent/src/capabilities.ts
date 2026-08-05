import type { ToolDefinition } from './types.js';

/**
 * A pluggable capability: a bundle of tools plus the handler that runs them. This is how Twinhaus
 * is extended without touching the core, third-party integrations and external agents register a
 * capability, and the agent gains its tools automatically. Capabilities are additive and advisory:
 * they cannot shadow a built-in tool, and device control stays in the core safety-gated path.
 */
export interface AgentCapability {
  /** Stable id, also used to namespace the capability's tools. */
  id: string;
  /** The tools this capability contributes to the agent. */
  tools: ToolDefinition[];
  /** Run one of this capability's tools and return its textual result. */
  execute(name: string, input: Record<string, unknown>): Promise<string>;
}

export interface HttpAgentOptions {
  /** Slug for the capability; its tool is exposed as `ask_<id>`. */
  id: string;
  /** Human name of the external agent, shown to the model. */
  name: string;
  /** What the external agent is good for, so the model knows when to call it. */
  description: string;
  /** HTTP(S) endpoint that accepts `{ query }` and replies with the answer. */
  url: string;
  /** Injected for testing; defaults to the global fetch. */
  fetchFn?: typeof fetch;
}

/**
 * Wrap a third-party agent reachable over HTTP as a capability. It exposes one tool, `ask_<id>`,
 * that POSTs `{ query }` to the endpoint and returns its answer, so an external assistant (a
 * weather brain, a vendor's support bot, your own service) becomes callable from Homie. The
 * endpoint must allow cross-origin requests from the app, or be proxied.
 */
export function createHttpAgentCapability(options: HttpAgentOptions): AgentCapability {
  const toolName = `ask_${options.id}`;
  return {
    id: options.id,
    tools: [
      {
        name: toolName,
        description: `Ask the ${options.name} agent. ${options.description}`,
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: `What to ask the ${options.name} agent.` },
          },
          required: ['query'],
        },
      },
    ],
    async execute(name, input) {
      if (name !== toolName) throw new Error(`Unknown tool: ${name}`);
      const fetchFn = options.fetchFn ?? fetch;
      let response: Response;
      try {
        response = await fetchFn(options.url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ query: String(input.query ?? '') }),
        });
      } catch (err) {
        return `Could not reach the ${options.name} agent: ${
          err instanceof Error ? err.message : String(err)
        }.`;
      }
      if (!response.ok) {
        return `The ${options.name} agent returned an error (${response.status}).`;
      }
      const data: unknown = await response.json().catch(() => null);
      return extractText(data) ?? `The ${options.name} agent gave no answer.`;
    },
  };
}

/** Pull a text answer out of a variety of common agent response shapes. */
function extractText(data: unknown): string | null {
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    for (const key of ['reply', 'text', 'answer', 'result', 'message', 'content']) {
      if (typeof record[key] === 'string') return record[key] as string;
    }
  }
  return null;
}

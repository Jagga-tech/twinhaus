# Capabilities: extending Homie with third-party agents

Homie's tools are not a fixed list. A **capability** is a plug-in bundle of tools plus the handler
that runs them, so you can extend what the agent can do without touching the core. This is how you
connect third-party agents and integrations.

## The contract

A capability implements `AgentCapability` (from `@twinhaus/agent`):

```ts
interface AgentCapability {
  id: string;
  tools: ToolDefinition[];
  execute(name: string, input: Record<string, unknown>): Promise<string>;
}
```

The agent merges a capability's tools into its toolset and routes matching tool calls to its
`execute`. Two rules keep it safe:

- A capability tool can **never shadow a built-in tool** or the safety-gated control path
  (`call_service`). Collisions are ignored.
- Capabilities are **advisory**: they return text. Device control stays in the core, behind the
  confirmation gate.

## Connect an external agent (no code)

In **Settings, Capabilities**, add an agent with a name, a one-line description of what it is for,
and an endpoint URL. Homie gains an `ask_<id>` tool: when a question fits, it POSTs `{ "query": "..." }`
to your endpoint and relays the answer. Your endpoint should reply with JSON containing a text field
(`reply`, `text`, `answer`, `result`, `message`, or `content`) or a plain string, and must allow
cross-origin requests from the app (or sit behind a proxy).

Under the hood this uses `createHttpAgentCapability`, which you can also use directly:

```ts
import { createHttpAgentCapability } from '@twinhaus/agent';

const weather = createHttpAgentCapability({
  id: 'weather',
  name: 'Weather brain',
  description: 'Answers questions about the weather',
  url: 'https://my-agent.example.com/ask',
});
// new Agent({ provider, context, capabilities: [weather] })
```

## Write a custom capability in code

For anything beyond a simple HTTP call, implement `AgentCapability` yourself and pass it in
`AgentOptions.capabilities`. Keep the handler pure where possible and unit-test it; the tool
definitions are plain JSON Schema. See `packages/agent/src/capabilities.ts` for the reference
implementation and `capabilities.test.ts` for the test pattern.

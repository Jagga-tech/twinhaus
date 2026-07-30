/** A JSON-Schema tool definition, shared across every provider. */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/** A tool call requested by the model. `input` is the parsed JSON argument object. */
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** The result of executing a tool, fed back to the model to continue the turn. */
export interface ToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
}

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** One assistant step: any text it produced, plus any tools it wants to call. */
export interface AssistantTurn {
  text: string;
  toolCalls: ToolCall[];
}

/**
 * A pluggable LLM backend. The three built-in providers, Anthropic, OpenAI, and Ollama
 * (fully local), all satisfy this interface so the agent loop stays provider-agnostic.
 */
export interface LlmProvider {
  readonly id: string;
  /**
   * Run one model step. Implementations translate the shared message/tool shapes into
   * their own wire format and back.
   */
  complete(request: LlmRequest): Promise<AssistantTurn>;
}

export interface LlmRequest {
  system: string;
  /** Full conversation history, including prior tool calls and their results. */
  messages: ProviderMessage[];
  tools: ToolDefinition[];
}

/**
 * Internal message shape passed to providers. Richer than {@link ChatMessage} because it
 * has to carry tool calls and tool results through the loop.
 */
export type ProviderMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls: ToolCall[] }
  | { role: 'tool'; results: ToolResult[] };

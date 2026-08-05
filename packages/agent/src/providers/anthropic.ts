import type {
  AssistantTurn,
  LlmProvider,
  LlmRequest,
  ProviderMessage,
  ToolCall,
} from '../types.js';

export interface AnthropicProviderOptions {
  apiKey: string;
  /** Defaults to Claude Opus 5, the latest and most capable Claude model. */
  model?: string;
  /**
   * Twinhaus runs in the browser against the user's own key, so direct browser access is
   * enabled by default. Set false if you proxy requests through a server instead.
   */
  allowBrowser?: boolean;
  /**
   * Enable Claude's built-in, server-side web search tool, so the agent can actually look things up
   * on the internet ("find me a smart video doorbell", "what's the best value robot vacuum") and
   * answer with live results and citations. Runs on Anthropic's servers, so no CORS or extra key.
   * Default true; a per-search fee applies.
   */
  webSearch?: boolean;
  /** Cap the number of web searches per message. Default 3. */
  webSearchMaxUses?: number;
}

/** Anthropic Messages API provider. */
export class AnthropicProvider implements LlmProvider {
  readonly id = 'anthropic';
  private readonly apiKey: string;
  private readonly model: string;
  private readonly allowBrowser: boolean;
  private readonly webSearch: boolean;
  private readonly webSearchMaxUses: number;

  constructor(options: AnthropicProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? 'claude-opus-5';
    this.allowBrowser = options.allowBrowser ?? true;
    this.webSearch = options.webSearch ?? true;
    this.webSearchMaxUses = options.webSearchMaxUses ?? 3;
  }

  async complete(request: LlmRequest): Promise<AssistantTurn> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
    };
    if (this.allowBrowser) headers['anthropic-dangerous-direct-browser-access'] = 'true';

    // Cache the static system prompt so it is not re-billed on every step of the tool loop or on
    // repeat messages in a session. The dynamic home snapshot rides in a second, uncached block.
    const system = [
      { type: 'text', text: request.system, cache_control: { type: 'ephemeral' } },
      ...(request.context ? [{ type: 'text', text: request.context }] : []),
    ];

    const tools: unknown[] = request.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));
    // Claude runs this one server-side: it searches the web and folds the results into its answer,
    // so nothing comes back into our tool loop, we just get text with citations.
    if (this.webSearch) {
      tools.push({
        type: 'web_search_20250305',
        name: 'web_search',
        max_uses: this.webSearchMaxUses,
      });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.model,
        max_tokens: 1024,
        system,
        tools,
        messages: request.messages.map(toAnthropicMessage),
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error (${response.status}): ${await response.text()}`);
    }

    const data = (await response.json()) as {
      content: Array<
        | { type: 'text'; text: string }
        | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
      >;
    };

    const text = data.content
      .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
      .map((block) => block.text)
      .join('');

    const toolCalls: ToolCall[] = data.content
      .filter((block) => block.type === 'tool_use')
      .map((block) => {
        const call = block as { id: string; name: string; input: Record<string, unknown> };
        return { id: call.id, name: call.name, input: call.input };
      });

    return { text, toolCalls };
  }
}

function toAnthropicMessage(message: ProviderMessage): unknown {
  if (message.role === 'user') {
    return { role: 'user', content: message.content };
  }
  if (message.role === 'assistant') {
    const content: unknown[] = [];
    if (message.content) content.push({ type: 'text', text: message.content });
    for (const call of message.toolCalls) {
      content.push({ type: 'tool_use', id: call.id, name: call.name, input: call.input });
    }
    return { role: 'assistant', content };
  }
  return {
    role: 'user',
    content: message.results.map((result) => ({
      type: 'tool_result',
      tool_use_id: result.toolCallId,
      content: result.content,
      is_error: result.isError,
    })),
  };
}

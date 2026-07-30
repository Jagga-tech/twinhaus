import type {
  AssistantTurn,
  LlmProvider,
  LlmRequest,
  ProviderMessage,
  ToolCall,
} from '../types.js';

export interface OpenAiProviderOptions {
  apiKey: string;
  model?: string;
  /** Override for OpenAI-compatible gateways. Defaults to the official API. */
  baseUrl?: string;
}

/** OpenAI Chat Completions provider (also works with OpenAI-compatible gateways). */
export class OpenAiProvider implements LlmProvider {
  readonly id = 'openai';
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(options: OpenAiProviderOptions) {
    this.apiKey = options.apiKey;
    this.model = options.model ?? 'gpt-4o';
    this.baseUrl = (options.baseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
  }

  async complete(request: LlmRequest): Promise<AssistantTurn> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: toOpenAiMessages(request.system, request.messages),
        tools: request.tools.map((tool) => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema,
          },
        })),
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error (${response.status}): ${await response.text()}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: OpenAiAssistantMessage }>;
    };
    return fromOpenAiMessage(data.choices[0]?.message);
  }
}

interface OpenAiAssistantMessage {
  content: string | null;
  tool_calls?: Array<{
    id: string;
    function: { name: string; arguments: string };
  }>;
}

/** Shared translation to OpenAI wire format, reused by the Ollama provider. */
export function toOpenAiMessages(system: string, messages: ProviderMessage[]): unknown[] {
  const result: unknown[] = [{ role: 'system', content: system }];
  for (const message of messages) {
    if (message.role === 'user') {
      result.push({ role: 'user', content: message.content });
    } else if (message.role === 'assistant') {
      result.push({
        role: 'assistant',
        content: message.content || null,
        tool_calls: message.toolCalls.length
          ? message.toolCalls.map((call) => ({
              id: call.id,
              type: 'function',
              function: { name: call.name, arguments: JSON.stringify(call.input) },
            }))
          : undefined,
      });
    } else {
      for (const toolResult of message.results) {
        result.push({
          role: 'tool',
          tool_call_id: toolResult.toolCallId,
          content: toolResult.content,
        });
      }
    }
  }
  return result;
}

/** Shared translation from an OpenAI-format assistant message, reused by the Ollama provider. */
export function fromOpenAiMessage(message: OpenAiAssistantMessage | undefined): AssistantTurn {
  const toolCalls: ToolCall[] = (message?.tool_calls ?? []).map((call, index) => ({
    id: call.id || `call_${index}`,
    name: call.function.name,
    input: safeParse(call.function.arguments),
  }));
  return { text: message?.content ?? '', toolCalls };
}

function safeParse(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

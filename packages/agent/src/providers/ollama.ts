import { fromOpenAiMessage, toOpenAiMessages } from './openai.js';
import type { AssistantTurn, LlmProvider, LlmRequest } from '../types.js';

export interface OllamaProviderOptions {
  /** A local, tool-capable model, e.g. `llama3.1` or `qwen2.5`. */
  model?: string;
  /** Base URL of the Ollama server. Defaults to the local daemon. */
  baseUrl?: string;
}

/**
 * Ollama provider for fully local inference, no data leaves the machine. Uses Ollama's
 * OpenAI-compatible endpoint so it shares translation with {@link OpenAiProvider}.
 *
 * Privacy is a first-class concern for the Home Assistant community, so this path is a
 * hard requirement, not an afterthought.
 */
export class OllamaProvider implements LlmProvider {
  readonly id = 'ollama';
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(options: OllamaProviderOptions = {}) {
    this.model = options.model ?? 'llama3.1';
    this.baseUrl = (options.baseUrl ?? 'http://localhost:11434').replace(/\/+$/, '');
  }

  async complete(request: LlmRequest): Promise<AssistantTurn> {
    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
      throw new Error(`Ollama error (${response.status}): ${await response.text()}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: Parameters<typeof fromOpenAiMessage>[0] }>;
    };
    return fromOpenAiMessage(data.choices[0]?.message);
  }
}

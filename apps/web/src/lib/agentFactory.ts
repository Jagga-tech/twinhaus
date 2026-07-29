import {
  Agent,
  AnthropicProvider,
  OllamaProvider,
  OpenAiProvider,
  type LlmProvider,
} from '@twinhaus/agent';
import type { LlmConfig } from '../store/twinStore.js';
import { createHomeContext } from './homeContext.js';
import { haClient } from '../hooks/useHaConnection.js';

/** Build an {@link LlmProvider} from the user's saved settings. */
export function createProvider(config: LlmConfig): LlmProvider {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicProvider({ apiKey: config.apiKey, model: config.model });
    case 'openai':
      return new OpenAiProvider({
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl || undefined,
      });
    case 'ollama':
      return new OllamaProvider({ model: config.model, baseUrl: config.baseUrl || undefined });
  }
}

/** Build a fresh {@link Agent} wired to the shared Home Assistant connection and twin. */
export function createAgent(config: LlmConfig): Agent {
  return new Agent({
    provider: createProvider(config),
    context: createHomeContext(haClient),
  });
}

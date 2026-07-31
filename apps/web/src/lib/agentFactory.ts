import {
  Agent,
  AnthropicProvider,
  OllamaProvider,
  OpenAiProvider,
  type ControlAction,
  type LlmProvider,
  type SafetyVerdict,
} from '@twinhaus/agent';
import type { LlmConfig } from '../store/twinStore.js';
import { createHomeContext } from './homeContext.js';
import { activeProvider } from './provider/index.js';

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

/** Approve or decline a guarded action; the chat UI supplies this to gate sensitive control. */
export type ConfirmAction = (action: ControlAction, verdict: SafetyVerdict) => Promise<boolean>;

/**
 * Build a fresh {@link Agent} wired to the shared Home Assistant connection and twin. Pass
 * `confirmAction` to gate guarded actions (unlocking, disarming, opening, whole-home) behind a
 * user prompt; without it the agent declines those actions rather than run them unattended.
 */
export function createAgent(config: LlmConfig, confirmAction?: ConfirmAction): Agent {
  return new Agent({
    provider: createProvider(config),
    context: createHomeContext(activeProvider()),
    confirmAction,
  });
}

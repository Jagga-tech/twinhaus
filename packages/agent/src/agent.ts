import { executeTool, TOOL_DEFINITIONS, type HomeContext } from './tools.js';
import type {
  AssistantTurn,
  ChatMessage,
  LlmProvider,
  ProviderMessage,
  ToolResult,
} from './types.js';

const SYSTEM_PROMPT = `You are the AI brain of Twinhaus, a live 3D digital twin of the user's home built on top of Home Assistant.

You control real devices through tools. When the user asks you to do something ("dim the living room", "lock the back door"), figure out which entities are involved and call the tools to make it happen. Use describe_home or get_room_devices when you need to know what exists before acting.

For routines and automations ("turn off everything when I leave", "movie mode", "run the good night scene"), use list_entities to find the relevant entity ids (by domain — e.g. "light", "scene", "automation"), then call_service on each one. Activate a scene with domain "scene" service "turn_on"; trigger an automation with domain "automation" service "trigger". For energy questions, use get_energy_by_room.

Be concise and confirm what you did in plain language ("Dimmed the living room to 40% and locked the back door."). If you can't find a matching device, say so rather than guessing an entity id.`;

export interface AgentOptions {
  provider: LlmProvider;
  context: HomeContext;
  /** Safety cap on tool-call rounds per user message. */
  maxSteps?: number;
}

/** Emitted as the agent works, so the UI can show tool activity as it happens. */
export type AgentEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; name: string; content: string; isError: boolean };

/**
 * The chat-control agent. Runs a tool-calling loop against a pluggable {@link LlmProvider},
 * dispatching each tool call to the {@link HomeContext} (twin state + Home Assistant) until
 * the model produces a final answer with no further tool calls.
 */
export class Agent {
  private readonly provider: LlmProvider;
  private readonly context: HomeContext;
  private readonly maxSteps: number;
  private readonly history: ProviderMessage[] = [];

  constructor(options: AgentOptions) {
    this.provider = options.provider;
    this.context = options.context;
    this.maxSteps = options.maxSteps ?? 6;
  }

  /** The user-facing conversation so far, tool traffic stripped out. */
  getTranscript(): ChatMessage[] {
    const transcript: ChatMessage[] = [];
    for (const message of this.history) {
      if (message.role === 'user') {
        transcript.push({ role: 'user', content: message.content });
      } else if (message.role === 'assistant' && message.content) {
        transcript.push({ role: 'assistant', content: message.content });
      }
    }
    return transcript;
  }

  /**
   * Send a user message and drive the tool loop to completion. `onEvent` streams progress
   * (assistant text, tool calls, tool results); the returned string is the final reply.
   */
  async send(userMessage: string, onEvent?: (event: AgentEvent) => void): Promise<string> {
    this.history.push({ role: 'user', content: userMessage });

    let finalText = '';
    for (let step = 0; step < this.maxSteps; step++) {
      const turn = await this.provider.complete({
        system: SYSTEM_PROMPT,
        messages: this.history,
        tools: TOOL_DEFINITIONS,
      });

      this.recordAssistantTurn(turn, onEvent);
      finalText = turn.text;

      if (turn.toolCalls.length === 0) break;

      const results = await this.runToolCalls(turn, onEvent);
      this.history.push({ role: 'tool', results });
    }

    return finalText;
  }

  private recordAssistantTurn(turn: AssistantTurn, onEvent?: (event: AgentEvent) => void): void {
    this.history.push({ role: 'assistant', content: turn.text, toolCalls: turn.toolCalls });
    if (turn.text && onEvent) onEvent({ type: 'text', text: turn.text });
  }

  private async runToolCalls(
    turn: AssistantTurn,
    onEvent?: (event: AgentEvent) => void,
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    for (const call of turn.toolCalls) {
      onEvent?.({ type: 'tool_call', name: call.name, input: call.input });
      try {
        const content = await executeTool(this.context, call.name, call.input);
        results.push({ toolCallId: call.id, content });
        onEvent?.({ type: 'tool_result', name: call.name, content, isError: false });
      } catch (err) {
        const content = err instanceof Error ? err.message : String(err);
        results.push({ toolCallId: call.id, content, isError: true });
        onEvent?.({ type: 'tool_result', name: call.name, content, isError: true });
      }
    }
    return results;
  }
}

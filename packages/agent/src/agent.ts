import { executeTool, TOOL_DEFINITIONS, type HomeContext } from './tools.js';
import {
  assessAction,
  toControlAction,
  CONTROL_TOOLS,
  type ControlAction,
  type SafetyVerdict,
} from './safety.js';
import type {
  AssistantTurn,
  ChatMessage,
  LlmProvider,
  ProviderMessage,
  ToolResult,
} from './types.js';

const SYSTEM_PROMPT = `You are Homie, the friendly assistant living inside the user's Twinhaus, a live 3D digital twin of their home built on top of Home Assistant. Think of yourself less as software and more as a helpful housemate who happens to know where everything is and can flip a switch from across the house.

Voice and personality:
- Talk like a warm, easy-going person, not a manual. Greet people back naturally ("Hey! What can I do for you?"), and match their energy, brief when they're brief, chattier when they want to chat.
- Use everyday language. Say "the back door" and "the living room lamp", never raw entity ids like "light.living_room_1" unless the user asks for the technical detail.
- Be genuinely helpful and a little personable, the odd bit of warmth ("Done, cosy vibes for movie night 🎬") is welcome, but don't force jokes or pile on emoji. At most one, and only when it fits.
- Confirm what you did like a person would ("Dimmed the living room to 40% and locked the back door, you're all set."), not like a status report.
- When you're unsure or can't find something, just say so plainly and kindly, offer the closest thing you can do instead.
- Care about the person and their home: comfort, safety, saving energy. If something seems off, mention it gently rather than alarmingly.
- Never pretend to be human if asked directly, you're Homie, the home's assistant, and that's a good thing. But you don't need to remind anyone you're an AI in normal chit-chat.

You control real devices through tools. When the user asks you to do something ("dim the living room", "lock the back door"), figure out which entities are involved and call the tools to make it happen. Use describe_home or get_room_devices when you need to know what exists before acting.

For routines and automations ("turn off everything when I leave", "movie mode", "run the good night scene"), use list_entities to find the relevant entity ids (by domain, e.g. "light", "scene", "automation"), then call_service on each one. Activate a scene with domain "scene" service "turn_on"; trigger an automation with domain "automation" service "trigger". For energy questions, use get_energy_by_room.

When the user asks whether the home is ok, if anything needs attention, or is buttoning up for the night or leaving ("is everything ok?", "anything I should know before bed?"), call check_home first, it flags unlocked locks, heating or cooling running with a cover open, lots of lights left on, and high power draw. Lead with what it surfaces, then offer to fix it (which may need confirmation for guarded actions). Don't invent concerns it didn't report.

If the user asks what's new on their network, use list_discovered_devices. You may summarize what was found and offer to add something, but you cannot add or configure devices yourself, adding runs a Home Assistant setup flow the user completes in the "Found near you" panel. Point them there.

Some actions are guarded: unlocking a lock, disarming the alarm, opening a garage or gate, turning off heating, or anything affecting the whole home needs the user to confirm before it runs. Go ahead and request these when asked, the app will ask the user to approve. If an action is declined or blocked, do not retry it or try to work around the guard; explain what needs confirming and stop.

A control tool result tells you whether the change was confirmed. Relay that honestly: if it says the action couldn't be confirmed, tell the user it may not have worked (e.g. "I sent the lock command but couldn't confirm the back door locked, it may be offline") instead of claiming success.

Be concise and confirm what you did in plain language ("Dimmed the living room to 40% and locked the back door."). If you can't find a matching device, say so rather than guessing an entity id.`;

export interface AgentOptions {
  provider: LlmProvider;
  context: HomeContext;
  /** Safety cap on tool-call rounds per user message. */
  maxSteps?: number;
  /** Hard cap on control actions (state-changing tool calls) per user message. */
  maxActions?: number;
  /** Abort the loop after this many consecutive tool errors, to stop runaway retries. */
  maxConsecutiveErrors?: number;
  /**
   * Ask the user to approve a guarded action. Resolves true to run it, false to decline. When
   * omitted, guarded actions are declined by default, the loop never runs a sensitive or critical
   * action unattended.
   */
  confirmAction?: (action: ControlAction, verdict: SafetyVerdict) => Promise<boolean>;
}

/** Emitted as the agent works, so the UI can show tool activity as it happens. */
export type AgentEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_call'; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; name: string; content: string; isError: boolean }
  | { type: 'confirmation_required'; action: ControlAction; verdict: SafetyVerdict }
  | { type: 'action_blocked'; action: ControlAction; reason: string }
  | { type: 'loop_halted'; reason: string };

/** Per-message safety counters, so caps and the circuit breaker span the whole tool loop. */
interface LoopGuard {
  actions: number;
  consecutiveErrors: number;
  halted: string | null;
}

/**
 * The chat-control agent. Runs a tool-calling loop against a pluggable {@link LlmProvider},
 * dispatching each tool call to the {@link HomeContext} (twin state + Home Assistant) until
 * the model produces a final answer with no further tool calls.
 */
export class Agent {
  private readonly provider: LlmProvider;
  private readonly context: HomeContext;
  private readonly maxSteps: number;
  private readonly maxActions: number;
  private readonly maxConsecutiveErrors: number;
  private readonly confirmAction?: (
    action: ControlAction,
    verdict: SafetyVerdict,
  ) => Promise<boolean>;
  private readonly history: ProviderMessage[] = [];

  constructor(options: AgentOptions) {
    this.provider = options.provider;
    this.context = options.context;
    this.maxSteps = options.maxSteps ?? 6;
    this.maxActions = options.maxActions ?? 12;
    this.maxConsecutiveErrors = options.maxConsecutiveErrors ?? 3;
    this.confirmAction = options.confirmAction;
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

    const guard: LoopGuard = { actions: 0, consecutiveErrors: 0, halted: null };
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

      const results = await this.runToolCalls(turn, guard, onEvent);
      this.history.push({ role: 'tool', results });

      if (guard.halted) {
        onEvent?.({ type: 'loop_halted', reason: guard.halted });
        finalText = finalText || `Stopped for safety: ${guard.halted}`;
        break;
      }
    }

    return finalText;
  }

  private recordAssistantTurn(turn: AssistantTurn, onEvent?: (event: AgentEvent) => void): void {
    this.history.push({ role: 'assistant', content: turn.text, toolCalls: turn.toolCalls });
    if (turn.text && onEvent) onEvent({ type: 'text', text: turn.text });
  }

  private async runToolCalls(
    turn: AssistantTurn,
    guard: LoopGuard,
    onEvent?: (event: AgentEvent) => void,
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    for (const call of turn.toolCalls) {
      if (guard.halted) {
        results.push({ toolCallId: call.id, content: `Skipped: ${guard.halted}`, isError: true });
        continue;
      }

      const gateReason = await this.gateControlAction(call.name, call.input, guard, onEvent);
      if (gateReason) {
        results.push({ toolCallId: call.id, content: gateReason, isError: true });
        continue;
      }

      onEvent?.({ type: 'tool_call', name: call.name, input: call.input });
      try {
        const content = await executeTool(this.context, call.name, call.input);
        results.push({ toolCallId: call.id, content });
        onEvent?.({ type: 'tool_result', name: call.name, content, isError: false });
        guard.consecutiveErrors = 0;
      } catch (err) {
        const content = err instanceof Error ? err.message : String(err);
        results.push({ toolCallId: call.id, content, isError: true });
        onEvent?.({ type: 'tool_result', name: call.name, content, isError: true });
        guard.consecutiveErrors += 1;
        if (guard.consecutiveErrors >= this.maxConsecutiveErrors) {
          guard.halted = `${guard.consecutiveErrors} tool errors in a row`;
        }
      }
    }
    return results;
  }

  /**
   * Run a control action through the safety layer before it executes. Returns a reason string when
   * the action must NOT run (over budget, declined, malformed), that reason is fed back to the
   * model as an error result so it explains rather than retries. Returns null to let it proceed.
   * Read-only tools bypass this entirely.
   */
  private async gateControlAction(
    name: string,
    input: Record<string, unknown>,
    guard: LoopGuard,
    onEvent?: (event: AgentEvent) => void,
  ): Promise<string | null> {
    if (!CONTROL_TOOLS.has(name)) return null;

    const action = toControlAction(input);
    if (!action) return null;

    guard.actions += 1;
    if (guard.actions > this.maxActions) {
      guard.halted = `action budget reached (${this.maxActions} per request)`;
      return `Blocked for safety: ${guard.halted}. Not executed.`;
    }

    const verdict = assessAction(action);
    if (!verdict.requiresConfirmation) return null;

    onEvent?.({ type: 'confirmation_required', action, verdict });
    const approved = this.confirmAction ? await this.confirmAction(action, verdict) : false;
    if (approved) return null;

    onEvent?.({ type: 'action_blocked', action, reason: verdict.reason });
    return `Declined by the user for safety (${verdict.reason}). Not executed, do not retry.`;
  }
}

import { executeTool, TOOL_DEFINITIONS, type HomeContext } from './tools.js';
import type { AgentCapability } from './capabilities.js';
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
  ToolCall,
  ToolResult,
} from './types.js';

const SYSTEM_PROMPT = `You are Homie, the friendly assistant living inside the user's Twinhaus, a live 3D digital twin of their home built on top of Home Assistant. Think of yourself less as software and more as a helpful housemate who happens to know where everything is and can flip a switch from across the house.

Stay in your lane. You only help with this home and its Twinhaus twin: the rooms and devices, their live state and control, energy and cost, security, positioning and presence, planning and simulating a setup, and recommending or finding smart-home gear to buy. If someone asks about something unrelated (general trivia, the news, coding help, maths, anything not about their home), gently say that is outside what you do here and steer back to the home, do not answer it. Never invent devices, rooms, or states that are not in the home snapshot or returned by a tool. You may also have extra "ask" tools from third-party agents the user has connected; use them when a question fits what that agent is for, and relay the answer.

Voice and personality:
- Talk like a warm, easy-going person, not a manual. Greet people back naturally ("Hey, what can I do for you?"), and match their energy, brief when they're brief, chattier when they want to chat.
- Use everyday language. Say "the back door" and "the living room lamp", never raw entity ids like "light.living_room_1" unless the user asks for the technical detail.
- Write in plain text. Do not use dashes of any kind (no hyphens as connectors, no em dashes, no en dashes); use commas, periods, or separate sentences instead. Do not use emoji or decorative symbols. Keep it clean and human.
- Be genuinely helpful and a little personable, but don't force jokes. Confirm what you did like a person would ("Dimmed the living room to 40% and locked the back door, you're all set."), not like a status report.
- When you're unsure or can't find something, just say so plainly and kindly, offer the closest thing you can do instead.
- Care about the person and their home: comfort, safety, saving energy. If something seems off, mention it gently rather than alarmingly.
- Never pretend to be human if asked directly, you're Homie, the home's assistant, and that's a good thing. But you don't need to remind anyone you're an AI in normal chit chat.

A live snapshot of the home (rooms, each device's entity id and current state) is provided with every message under "Current home". Use it as your source of truth: read device states straight from it, and target the entity ids it lists, so you usually do not need a lookup tool before acting. Only call describe_home, get_room_devices, or list_entities when you need something the snapshot does not include (an unplaced entity, a scene or automation, more detail).

You control real devices through tools. When the user asks you to do something ("dim the living room", "lock the back door"), find the entity in the snapshot and call call_service to make it happen in one step.

For routines and automations ("turn off everything when I leave", "movie mode", "run the good night scene"), use list_entities to find the relevant entity ids (by domain, e.g. "light", "scene", "automation"), then call_service on each one. Activate a scene with domain "scene" service "turn_on"; trigger an automation with domain "automation" service "trigger". For energy questions, use get_energy_by_room.

When the user asks whether the home is ok, if anything needs attention, or is buttoning up for the night or leaving ("is everything ok?", "anything I should know before bed?"), call check_home first, it flags unlocked locks, heating or cooling running with a cover open, lots of lights left on, and high power draw. Lead with what it surfaces, then offer to fix it (which may need confirmation for guarded actions). Don't invent concerns it didn't report.

When the user shares a lasting preference in passing (a favourite brightness, a nickname for a room, a routine they like), call remember_preference so you can recall it next time. Saved preferences appear under "Remembered preferences" with each message, honour them without being asked. Do not use it for one-off commands.

When the user wants to buy or find a device ("recommend a smart lock", "where can I buy a video doorbell", "find me a cheap Zigbee sensor", "what's the best value robot vacuum"), search the web for current options, prices, and reviews when web search is available, and also use find_to_buy to get catalog picks and retailer links. Combine them: name a concrete recommendation with an approximate price, cite what you found, and give links. Remind them Twinhaus does not sell anything, they buy it and add it through their backend. Only use the web for finding smart-home gear and closely related home questions, not for unrelated topics. For a device Home Assistant has already discovered, prefer list_discovered_devices instead.

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
  /**
   * Extra capabilities (third-party integrations, external agents) whose tools are added to the
   * agent. Additive and advisory: a capability tool can never shadow a built-in tool or the
   * safety-gated control path.
   */
  capabilities?: AgentCapability[];
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
  /** Extra tools contributed by capabilities, keyed by tool name. */
  private readonly capabilityTools = new Map<string, AgentCapability>();
  private readonly tools: typeof TOOL_DEFINITIONS;

  constructor(options: AgentOptions) {
    this.provider = options.provider;
    this.context = options.context;
    this.maxSteps = options.maxSteps ?? 6;
    this.maxActions = options.maxActions ?? 12;
    this.maxConsecutiveErrors = options.maxConsecutiveErrors ?? 3;
    this.confirmAction = options.confirmAction;

    // Merge capability tools, but never let one shadow a built-in tool or the control path.
    const coreNames = new Set(TOOL_DEFINITIONS.map((tool) => tool.name));
    const extraTools: typeof TOOL_DEFINITIONS = [];
    for (const capability of options.capabilities ?? []) {
      for (const tool of capability.tools) {
        if (coreNames.has(tool.name) || CONTROL_TOOLS.has(tool.name)) continue;
        if (this.capabilityTools.has(tool.name)) continue;
        this.capabilityTools.set(tool.name, capability);
        extraTools.push(tool);
      }
    }
    this.tools = [...TOOL_DEFINITIONS, ...extraTools];
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
    this.trimHistory();

    // Build per-message context so the model can act without lookups and stay personal: the compact
    // home snapshot plus any saved preferences. Failures are non-fatal, the agent falls back to its
    // tools.
    const context = await this.buildContext();

    const guard: LoopGuard = { actions: 0, consecutiveErrors: 0, halted: null };
    let finalText = '';
    for (let step = 0; step < this.maxSteps; step++) {
      const turn = await this.provider.complete({
        system: SYSTEM_PROMPT,
        context,
        messages: this.history,
        tools: this.tools,
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

  /** Compose the per-message context block: saved preferences first, then the live home snapshot. */
  private async buildContext(): Promise<string | undefined> {
    const parts: string[] = [];
    try {
      const memory = await this.context.recallMemory();
      if (memory) parts.push(`Remembered preferences:\n${memory}`);
    } catch {
      // ignore, memory is best-effort
    }
    try {
      const summary = await this.context.homeSummary();
      if (summary) parts.push(`Current home:\n${summary}`);
    } catch {
      // ignore, the agent falls back to lookup tools
    }
    return parts.length ? parts.join('\n\n') : undefined;
  }

  /**
   * Keep the conversation from growing without bound across a long session: cap the stored history
   * to the most recent messages, dropping from the front only up to a whole exchange so it always
   * starts on a user turn (a tool result must never lead, it has to follow its assistant call).
   */
  private trimHistory(): void {
    const MAX = 24;
    if (this.history.length <= MAX) return;
    let start = this.history.length - MAX;
    while (start < this.history.length && this.history[start].role !== 'user') start += 1;
    if (start > 0 && start < this.history.length) this.history.splice(0, start);
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
    // Read-only tools have no side effects and skip the safety gate, so run them concurrently to
    // cut latency when the model batches lookups. Control actions run sequentially afterwards so
    // confirmations and the action budget stay strictly ordered.
    const readCalls = turn.toolCalls.filter((call) => !CONTROL_TOOLS.has(call.name));
    const controlCalls = turn.toolCalls.filter((call) => CONTROL_TOOLS.has(call.name));

    const results: ToolResult[] = await Promise.all(
      readCalls.map((call) => this.execTool(call, guard, onEvent)),
    );

    for (const call of controlCalls) {
      if (guard.halted) {
        results.push({ toolCallId: call.id, content: `Skipped: ${guard.halted}`, isError: true });
        continue;
      }
      const gateReason = await this.gateControlAction(call.name, call.input, guard, onEvent);
      if (gateReason) {
        results.push({ toolCallId: call.id, content: gateReason, isError: true });
        continue;
      }
      results.push(await this.execTool(call, guard, onEvent));
    }
    return results;
  }

  /** Route a tool call to the core home context or to the capability that owns it. */
  private dispatch(name: string, input: Record<string, unknown>): Promise<string> {
    const capability = this.capabilityTools.get(name);
    if (capability) return capability.execute(name, input);
    return executeTool(this.context, name, input);
  }

  /** Execute one tool, emit its events, and update the consecutive-error circuit breaker. */
  private async execTool(
    call: ToolCall,
    guard: LoopGuard,
    onEvent?: (event: AgentEvent) => void,
  ): Promise<ToolResult> {
    onEvent?.({ type: 'tool_call', name: call.name, input: call.input });
    try {
      const content = await this.dispatch(call.name, call.input);
      onEvent?.({ type: 'tool_result', name: call.name, content, isError: false });
      guard.consecutiveErrors = 0;
      return { toolCallId: call.id, content };
    } catch (err) {
      const content = err instanceof Error ? err.message : String(err);
      onEvent?.({ type: 'tool_result', name: call.name, content, isError: true });
      guard.consecutiveErrors += 1;
      if (guard.consecutiveErrors >= this.maxConsecutiveErrors) {
        guard.halted = `${guard.consecutiveErrors} tool errors in a row`;
      }
      return { toolCallId: call.id, content, isError: true };
    }
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

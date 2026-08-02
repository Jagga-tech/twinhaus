/**
 * The agent's safety layer. Every control action the model wants to run is assessed here before
 * it touches Home Assistant, so the loop can never cause a serious, hard-to-undo problem while
 * operating, unlocking the house, disarming the alarm, opening a garage, or cutting the heat in
 * winter. Read-only tools (describe_home, list_entities, ...) never reach this layer; only actions
 * that change device state do.
 */

/** A concrete control action distilled from a `call_service` tool call. */
export interface ControlAction {
  domain: string;
  service: string;
  entityId: string;
  data?: Record<string, unknown>;
}

/**
 * How risky an action is to run unattended.
 * - `safe`: routine, easily reversed (a light, a plug, a scene), runs without a prompt.
 * - `sensitive`: affects comfort or many devices at once, needs confirmation.
 * - `critical`: touches physical security or safety (locks, alarms, exterior openings, heating), *   needs confirmation, and is denied outright when no one is available to confirm.
 */
export type ActionRisk = 'safe' | 'sensitive' | 'critical';

export interface SafetyVerdict {
  risk: ActionRisk;
  requiresConfirmation: boolean;
  reason: string;
}

/** Services that unlock, disarm, or open a way into the home, the highest-consequence actions. */
const CRITICAL_RULES: Array<{ match: (a: ControlAction) => boolean; reason: string }> = [
  {
    match: (a) => a.domain === 'lock' && a.service === 'unlock',
    reason: 'unlocks a lock',
  },
  {
    match: (a) => a.domain === 'alarm_control_panel' && /disarm/.test(a.service),
    reason: 'disarms the alarm',
  },
  {
    match: (a) => a.domain === 'cover' && /open/.test(a.service),
    reason: 'opens a cover, garage, or gate',
  },
  {
    match: (a) =>
      a.domain === 'climate' && (a.service === 'turn_off' || a.service === 'set_hvac_mode'),
    reason: 'changes or turns off heating/cooling',
  },
];

/** Actions that are reversible but affect comfort, media, or a broad swath of the home. */
const SENSITIVE_RULES: Array<{ match: (a: ControlAction) => boolean; reason: string }> = [
  {
    match: (a) => a.domain === 'homeassistant',
    reason: 'affects many devices at once',
  },
  {
    match: (a) => a.domain === 'vacuum' || a.domain === 'water_heater',
    reason: 'controls a major appliance',
  },
  {
    match: (a) => a.domain === 'switch' && a.service === 'turn_off',
    reason: 'switches off a device that may be load-bearing',
  },
];

/** Classify a single control action. Rules are conservative, when unsure, escalate, never relax. */
export function assessAction(action: ControlAction): SafetyVerdict {
  for (const rule of CRITICAL_RULES) {
    if (rule.match(action)) {
      return { risk: 'critical', requiresConfirmation: true, reason: rule.reason };
    }
  }
  for (const rule of SENSITIVE_RULES) {
    if (rule.match(action)) {
      return { risk: 'sensitive', requiresConfirmation: true, reason: rule.reason };
    }
  }
  return { risk: 'safe', requiresConfirmation: false, reason: 'routine, easily reversed' };
}

/** Pull a {@link ControlAction} out of a raw `call_service` tool input, or null if malformed. */
export function toControlAction(input: Record<string, unknown>): ControlAction | null {
  const domain = typeof input.domain === 'string' ? input.domain : '';
  const service = typeof input.service === 'string' ? input.service : '';
  const entityId = typeof input.entity_id === 'string' ? input.entity_id : '';
  if (!domain || !service) return null;
  return {
    domain,
    service,
    entityId,
    data: (input.data as Record<string, unknown> | undefined) ?? undefined,
  };
}

/** The tool names that change device state and therefore pass through the safety layer. */
export const CONTROL_TOOLS = new Set(['call_service']);

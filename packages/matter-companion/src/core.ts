/**
 * The Matter companion service, minus the transport. This is the reference implementation of the
 * service half of the contract the browser's MatterProvider speaks: it holds a device fabric,
 * answers `subscribe` with a snapshot, and applies `command` messages, emitting the resulting
 * state changes as `event` messages.
 *
 * The fabric here is simulated so the Matter backend has something to connect to out of the box.
 * To drive real Matter hardware, replace {@link CompanionCore}'s state store with a bridge to a
 * controller such as python-matter-server; the message shapes stay identical.
 */

export interface CompanionState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown>;
  last_changed: string;
  last_updated: string;
}

export type Inbound =
  | { type: 'subscribe' }
  | {
      type: 'command';
      domain: string;
      service: string;
      entity_id: string;
      data?: Record<string, unknown>;
    };

export type Outbound =
  { type: 'snapshot'; states: CompanionState[] } | { type: 'event'; state: CompanionState };

/** A small simulated Matter fabric: a couple of lights, a lock, and a plug. */
export function seedFabric(): CompanionState[] {
  const now = '2024-01-01T00:00:00Z';
  const s = (
    entity_id: string,
    state: string,
    attributes: Record<string, unknown> = {},
  ): CompanionState => ({ entity_id, state, attributes, last_changed: now, last_updated: now });
  return [
    s('light.matter_ceiling', 'off', { friendly_name: 'Matter Ceiling' }),
    s('light.matter_desk', 'on', { friendly_name: 'Matter Desk', brightness: 200 }),
    s('lock.matter_front', 'locked', { friendly_name: 'Matter Front Door' }),
    s('switch.matter_plug', 'off', { friendly_name: 'Matter Plug' }),
  ];
}

export class CompanionCore {
  private readonly states = new Map<string, CompanionState>();

  constructor(seed: CompanionState[] = seedFabric()) {
    for (const state of seed) this.states.set(state.entity_id, state);
  }

  /** Handle one inbound message, returning the messages to send back to the client. */
  handle(message: Inbound): Outbound[] {
    if (message.type === 'subscribe') {
      return [{ type: 'snapshot', states: [...this.states.values()] }];
    }
    if (message.type === 'command') {
      const current = this.states.get(message.entity_id);
      if (!current) return [];
      const next = applyCommand(current, message.service, message.data);
      if (!next) return [];
      this.states.set(next.entity_id, next);
      return [{ type: 'event', state: next }];
    }
    return [];
  }
}

/** Compute the next state for a device given a service, or null when it does not apply. */
function applyCommand(
  state: CompanionState,
  service: string,
  data?: Record<string, unknown>,
): CompanionState | null {
  const attributes = { ...state.attributes };
  const set = (next: string): CompanionState => ({
    ...state,
    state: next,
    attributes,
    last_updated: bump(state.last_updated),
  });

  switch (service) {
    case 'turn_on': {
      if (typeof data?.brightness_pct === 'number') {
        attributes.brightness = Math.round((data.brightness_pct / 100) * 255);
      }
      if (Array.isArray(data?.rgb_color)) attributes.rgb_color = data.rgb_color;
      return set('on');
    }
    case 'turn_off':
      return set('off');
    case 'toggle':
      return set(state.state === 'on' ? 'off' : 'on');
    case 'lock':
      return set('locked');
    case 'unlock':
      return set('unlocked');
    default:
      return null;
  }
}

/** Nudge an ISO timestamp forward a second so clients see a fresh update. */
function bump(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso;
  return new Date(parsed + 1000).toISOString();
}

/** Parse an inbound JSON frame into a typed message, or null if it is not one we handle. */
export function parseInbound(raw: string): Inbound | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== 'object') return null;
  const msg = value as Record<string, unknown>;
  if (msg.type === 'subscribe') return { type: 'subscribe' };
  if (
    msg.type === 'command' &&
    typeof msg.domain === 'string' &&
    typeof msg.service === 'string' &&
    typeof msg.entity_id === 'string'
  ) {
    return {
      type: 'command',
      domain: msg.domain,
      service: msg.service,
      entity_id: msg.entity_id,
      data: (msg.data as Record<string, unknown> | undefined) ?? undefined,
    };
  }
  return null;
}

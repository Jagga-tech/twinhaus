import type {
  CallServiceOptions,
  ConnectionStatus,
  DeviceProvider,
  EntityState,
  ProviderConfig,
  StateChangedEvent,
} from './types.js';

/** The seed devices the demo home ships with. Entity ids match the demo twin's placements. */
function seedStates(): EntityState[] {
  const now = '2024-01-01T00:00:00Z';
  const s = (
    entity_id: string,
    state: string,
    attributes: EntityState['attributes'] = {},
  ): EntityState => ({ entity_id, state, attributes, last_changed: now, last_updated: now });

  return [
    s('light.demo_living_lamp', 'on', { friendly_name: 'Living Lamp', brightness: 180 }),
    s('light.demo_kitchen', 'off', { friendly_name: 'Kitchen Light' }),
    s('light.demo_bedroom', 'off', { friendly_name: 'Bedroom Light' }),
    s('switch.demo_tv_plug', 'on', { friendly_name: 'TV Plug' }),
    s('lock.demo_front', 'locked', { friendly_name: 'Front Door' }),
    s('climate.demo_thermostat', 'heat', {
      friendly_name: 'Thermostat',
      temperature: 21,
      current_temperature: 20.5,
    }),
    s('fan.demo_bedroom', 'off', { friendly_name: 'Bedroom Fan', percentage: 0 }),
    s('media_player.demo_tv', 'paused', { friendly_name: 'Living Room TV' }),
    s('binary_sensor.demo_hall_motion', 'off', {
      friendly_name: 'Hall Motion',
      device_class: 'motion',
    }),
    s('sensor.demo_power', '420', {
      friendly_name: 'Home Power',
      device_class: 'power',
      unit_of_measurement: 'W',
    }),
  ];
}

interface DemoOptions {
  /** Drive the ambient simulation with this scheduler; omit to disable auto-ticking (tests). */
  setIntervalFn?: (handler: () => void, ms: number) => ReturnType<typeof setInterval>;
  clearIntervalFn?: (handle: ReturnType<typeof setInterval>) => void;
  random?: () => number;
}

/**
 * A fully self-contained backend: no Home Assistant, no hub, no hardware. It seeds a small live
 * home, answers control calls by mutating in-memory state (and emitting the same `state_changed`
 * events a real backend would), and gently animates itself, so a first-run user can explore,
 * control devices, and see the twin react before connecting anything real.
 */
export class DemoProvider implements DeviceProvider {
  readonly id = 'demo';
  readonly label = 'Demo (no Home Assistant)';
  readonly standalone = true;
  readonly summary = 'Explore a simulated home instantly, no hub or hardware needed.';

  private states = new Map<string, EntityState>();
  private status: ConnectionStatus = 'disconnected';
  private readonly statusListeners = new Set<(s: ConnectionStatus) => void>();
  private readonly stateListeners = new Set<(e: StateChangedEvent) => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly opts: Required<Pick<DemoOptions, 'random'>> & DemoOptions;

  constructor(options: DemoOptions = {}) {
    this.opts = { random: options.random ?? Math.random, ...options };
    for (const state of seedStates()) this.states.set(state.entity_id, state);
  }

  async connect(_config: ProviderConfig = {}): Promise<void> {
    void _config;
    this.setStatus('connected');
    if (this.opts.setIntervalFn) {
      this.timer = this.opts.setIntervalFn(() => this.tick(), 5000);
    }
  }

  disconnect(): void {
    if (this.timer && this.opts.clearIntervalFn) this.opts.clearIntervalFn(this.timer);
    this.timer = null;
    this.setStatus('disconnected');
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  onStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onStateChanged(listener: (event: StateChangedEvent) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  onReconnected(): () => void {
    // The demo backend never drops, so it never reconnects.
    return () => undefined;
  }

  async getStates(): Promise<EntityState[]> {
    return [...this.states.values()];
  }

  async callService(options: CallServiceOptions): Promise<void> {
    const target = options.target?.entity_id;
    const ids = Array.isArray(target) ? target : target ? [target] : [];
    for (const id of ids) {
      const current = this.states.get(id);
      if (!current) continue;
      const next = applyService(current, options);
      if (next) this.commit(next);
    }
  }

  /** Advance the ambient simulation one step: drift the thermostat, blip motion, flicker a light. */
  private tick(): void {
    const thermostat = this.states.get('climate.demo_thermostat');
    if (thermostat) {
      const drift = (this.opts.random() - 0.5) * 0.4;
      const temp =
        Math.round((Number(thermostat.attributes.current_temperature ?? 20) + drift) * 10) / 10;
      this.commit({
        ...thermostat,
        attributes: { ...thermostat.attributes, current_temperature: temp },
      });
    }

    const motion = this.states.get('binary_sensor.demo_hall_motion');
    if (motion) {
      const detected = this.opts.random() > 0.6;
      this.commit({ ...motion, state: detected ? 'on' : 'off' });
    }
  }

  private commit(next: EntityState): void {
    const old = this.states.get(next.entity_id) ?? null;
    const updated: EntityState = { ...next, last_updated: bump(next.last_updated) };
    this.states.set(updated.entity_id, updated);
    for (const listener of this.stateListeners) {
      listener({ entity_id: updated.entity_id, new_state: updated, old_state: old });
    }
  }

  private setStatus(status: ConnectionStatus): void {
    this.status = status;
    for (const listener of this.statusListeners) listener(status);
  }
}

/** Compute the next state for a device given a service call; null when the call doesn't apply. */
function applyService(state: EntityState, options: CallServiceOptions): EntityState | null {
  const { service, serviceData } = options;
  const attrs = { ...state.attributes };
  const set = (next: string): EntityState => ({ ...state, state: next, attributes: attrs });

  switch (service) {
    case 'turn_on': {
      if (typeof serviceData?.brightness_pct === 'number') {
        attrs.brightness = Math.round((serviceData.brightness_pct / 100) * 255);
      }
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
    case 'open_cover':
      return set('open');
    case 'close_cover':
      return set('closed');
    case 'media_play_pause':
      return set(state.state === 'playing' ? 'paused' : 'playing');
    case 'media_play':
      return set('playing');
    case 'media_pause':
      return set('paused');
    case 'start':
      return set('cleaning');
    case 'return_to_base':
      return set('returning');
    case 'set_percentage': {
      const pct = Number(serviceData?.percentage ?? 0);
      attrs.percentage = pct;
      return set(pct > 0 ? 'on' : 'off');
    }
    case 'set_temperature': {
      if (typeof serviceData?.temperature === 'number') attrs.temperature = serviceData.temperature;
      return { ...state, attributes: attrs };
    }
    case 'set_hvac_mode': {
      const mode = typeof serviceData?.hvac_mode === 'string' ? serviceData.hvac_mode : state.state;
      return set(mode);
    }
    case 'alarm_arm_home':
      return set('armed_home');
    case 'alarm_arm_away':
      return set('armed_away');
    case 'alarm_disarm':
      return set('disarmed');
    default:
      return null;
  }
}

/** Nudge an ISO timestamp forward a second so consumers see it as a fresh update. */
function bump(iso: string): string {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return iso;
  return new Date(parsed + 1000).toISOString();
}

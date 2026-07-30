import { entityDomain, type CallServiceOptions, type HaEntityState } from '@twinhaus/ha-bridge';

/** A one-tap control the device inspector renders for a placed entity. */
export interface QuickControl {
  label: string;
  /** The service call to fire when tapped. */
  call: CallServiceOptions;
  /** Highlight the control when the device is already in this state. */
  active?: boolean;
}

/**
 * Derive the quick controls for an entity from its domain and current state. This is the
 * click-to-control surface, the same service calls the agent makes, exposed as buttons.
 */
export function quickControls(state: HaEntityState): QuickControl[] {
  const entity = state.entity_id;
  const domain = entityDomain(entity);
  const target = { entity_id: entity };
  const on = state.state === 'on';

  switch (domain) {
    case 'light':
    case 'switch':
      return [
        { label: 'On', call: { domain, service: 'turn_on', target }, active: on },
        { label: 'Off', call: { domain, service: 'turn_off', target }, active: !on },
        ...(domain === 'light'
          ? [
              {
                label: '30%',
                call: { domain, service: 'turn_on', target, serviceData: { brightness_pct: 30 } },
              },
              {
                label: '100%',
                call: { domain, service: 'turn_on', target, serviceData: { brightness_pct: 100 } },
              },
            ]
          : []),
      ];

    case 'fan': {
      const pct = Number(state.attributes.percentage ?? (on ? 100 : 0));
      return [
        { label: 'On', call: { domain, service: 'turn_on', target }, active: on },
        { label: 'Off', call: { domain, service: 'turn_off', target }, active: !on },
        {
          label: 'Low',
          call: { domain, service: 'set_percentage', target, serviceData: { percentage: 33 } },
          active: on && pct > 0 && pct <= 40,
        },
        {
          label: 'High',
          call: { domain, service: 'set_percentage', target, serviceData: { percentage: 100 } },
          active: on && pct > 80,
        },
      ];
    }

    case 'lock':
      return [
        {
          label: 'Lock',
          call: { domain, service: 'lock', target },
          active: state.state === 'locked',
        },
        {
          label: 'Unlock',
          call: { domain, service: 'unlock', target },
          active: state.state === 'unlocked',
        },
      ];

    case 'cover':
      return [
        {
          label: 'Open',
          call: { domain, service: 'open_cover', target },
          active: state.state === 'open',
        },
        {
          label: 'Close',
          call: { domain, service: 'close_cover', target },
          active: state.state === 'closed',
        },
        { label: 'Stop', call: { domain, service: 'stop_cover', target } },
      ];

    case 'climate': {
      const mode = String(state.state);
      return [
        { label: '-1°', call: climateStep(entity, state, -1) },
        { label: '+1°', call: climateStep(entity, state, +1) },
        {
          label: 'Heat',
          call: { domain, service: 'set_hvac_mode', target, serviceData: { hvac_mode: 'heat' } },
          active: mode === 'heat',
        },
        {
          label: 'Cool',
          call: { domain, service: 'set_hvac_mode', target, serviceData: { hvac_mode: 'cool' } },
          active: mode === 'cool',
        },
        {
          label: 'Off',
          call: { domain, service: 'set_hvac_mode', target, serviceData: { hvac_mode: 'off' } },
          active: mode === 'off',
        },
      ];
    }

    case 'media_player': {
      const playing = state.state === 'playing';
      return [
        {
          label: playing ? 'Pause' : 'Play',
          call: { domain, service: 'media_play_pause', target },
          active: playing,
        },
        { label: '⏮', call: { domain, service: 'media_previous_track', target } },
        { label: '⏭', call: { domain, service: 'media_next_track', target } },
        { label: 'Vol -', call: { domain, service: 'volume_down', target } },
        { label: 'Vol +', call: { domain, service: 'volume_up', target } },
      ];
    }

    case 'vacuum': {
      const cleaning = state.state === 'cleaning';
      return [
        {
          label: 'Clean',
          call: { domain, service: 'start', target },
          active: cleaning,
        },
        { label: 'Pause', call: { domain, service: 'pause', target } },
        {
          label: 'Dock',
          call: { domain, service: 'return_to_base', target },
          active: state.state === 'docked' || state.state === 'returning',
        },
      ];
    }

    case 'alarm_control_panel': {
      const s = state.state;
      return [
        {
          label: 'Home',
          call: { domain, service: 'alarm_arm_home', target },
          active: s === 'armed_home',
        },
        {
          label: 'Away',
          call: { domain, service: 'alarm_arm_away', target },
          active: s === 'armed_away',
        },
        {
          label: 'Disarm',
          call: { domain, service: 'alarm_disarm', target },
          active: s === 'disarmed',
        },
      ];
    }

    default:
      return [];
  }
}

function climateStep(entity: string, state: HaEntityState, delta: number): CallServiceOptions {
  const current = Number(state.attributes.temperature ?? 20);
  return {
    domain: 'climate',
    service: 'set_temperature',
    target: { entity_id: entity },
    serviceData: { temperature: Math.round((current + delta) * 10) / 10 },
  };
}

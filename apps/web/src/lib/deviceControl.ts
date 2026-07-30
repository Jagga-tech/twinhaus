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
    case 'fan':
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

    case 'climate':
      return [
        { label: '-1°', call: climateStep(entity, state, -1) },
        { label: '+1°', call: climateStep(entity, state, +1) },
      ];

    case 'media_player':
      return [
        {
          label: 'Play',
          call: { domain, service: 'media_play', target },
          active: state.state === 'playing',
        },
        {
          label: 'Pause',
          call: { domain, service: 'media_pause', target },
          active: state.state === 'paused',
        },
      ];

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

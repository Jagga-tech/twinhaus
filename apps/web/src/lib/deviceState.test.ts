import { describe, expect, it } from 'vitest';
import type { HaEntityState } from '@twinhaus/ha-bridge';
import { deviceGlow, isEntityActive, isSupportedDomain } from './deviceState.js';

function state(
  entity_id: string,
  s: string,
  attributes: HaEntityState['attributes'] = {},
): HaEntityState {
  return { entity_id, state: s, attributes, last_changed: '', last_updated: '' };
}

describe('isEntityActive', () => {
  it('treats a running vacuum and armed alarm as active', () => {
    expect(isEntityActive(state('vacuum.x', 'cleaning'))).toBe(true);
    expect(isEntityActive(state('alarm_control_panel.x', 'armed_away'))).toBe(true);
    expect(isEntityActive(state('climate.x', 'heat'))).toBe(true);
    expect(isEntityActive(state('light.x', 'off'))).toBe(false);
    expect(isEntityActive(undefined)).toBe(false);
  });
});

describe('deviceGlow', () => {
  it('is dark when the device is idle', () => {
    expect(deviceGlow(state('light.x', 'off')).intensity).toBe(0);
  });

  it('reflects a light real rgb_color when active', () => {
    const glow = deviceGlow(state('light.x', 'on', { rgb_color: [255, 0, 128] }));
    expect(glow.color).toBe('#ff0080');
    expect(glow.intensity).toBe(1);
  });

  it('dims with brightness but never below a visible floor', () => {
    const dim = deviceGlow(state('light.x', 'on', { brightness: 0 }));
    expect(dim.intensity).toBe(0.35);
    const mid = deviceGlow(state('light.x', 'on', { brightness: 128 }));
    expect(mid.intensity).toBeGreaterThan(0.35);
    expect(mid.intensity).toBeLessThan(1);
  });

  it('falls back to a warm default when active without a colour', () => {
    expect(deviceGlow(state('switch.x', 'on')).color).toBe('#ffca28');
  });
});

describe('isSupportedDomain', () => {
  it('covers the domains the twin can render and control', () => {
    for (const id of [
      'light.a',
      'fan.a',
      'media_player.a',
      'vacuum.a',
      'alarm_control_panel.a',
      'climate.a',
    ]) {
      expect(isSupportedDomain(id)).toBe(true);
    }
    expect(isSupportedDomain('weather.home')).toBe(false);
  });
});

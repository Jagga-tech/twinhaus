import { describe, expect, it } from 'vitest';
import type { HaEntityState } from '@twinhaus/ha-bridge';
import { categorize } from './deviceCategory.js';

function state(entity_id: string, attributes: HaEntityState['attributes'] = {}): HaEntityState {
  return { entity_id, state: 'on', attributes, last_changed: '', last_updated: '' };
}

describe('categorize', () => {
  it('maps domains to categories', () => {
    expect(categorize('light.x')).toBe('light');
    expect(categorize('lock.x')).toBe('lock');
    expect(categorize('camera.x')).toBe('camera');
    expect(categorize('media_player.x')).toBe('media');
    expect(categorize('cover.x')).toBe('cover');
    expect(categorize('climate.x')).toBe('climate');
    expect(categorize('fan.x')).toBe('fan');
    expect(categorize('vacuum.x')).toBe('vacuum');
  });

  it('splits binary sensors into motion vs generic sensor by device_class', () => {
    expect(
      categorize('binary_sensor.hall', state('binary_sensor.hall', { device_class: 'motion' })),
    ).toBe('motion');
    expect(
      categorize('binary_sensor.door', state('binary_sensor.door', { device_class: 'door' })),
    ).toBe('sensor');
  });

  it('falls back to "other" for unknown domains', () => {
    expect(categorize('weather.home')).toBe('other');
    expect(categorize('automation.night')).toBe('other');
  });
});

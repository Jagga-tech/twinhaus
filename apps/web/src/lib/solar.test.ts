import { describe, expect, it } from 'vitest';
import type { HaEntityState } from '@twinhaus/ha-bridge';
import { solarSummary } from './solar.js';

function st(id: string, state: string, attrs: HaEntityState['attributes'] = {}): HaEntityState {
  return { entity_id: id, state, attributes: attrs, last_changed: '', last_updated: '' };
}

function states(list: HaEntityState[]): Record<string, HaEntityState> {
  return Object.fromEntries(list.map((s) => [s.entity_id, s]));
}

describe('solarSummary', () => {
  it('returns null when there is no solar or battery', () => {
    expect(solarSummary(states([st('sensor.fridge', '80', { device_class: 'power' })]))).toBeNull();
  });

  it('sums solar and grid power by name and reads battery percentage', () => {
    const summary = solarSummary(
      states([
        st('sensor.solar_production', '2400', {
          device_class: 'power',
          friendly_name: 'Solar Production',
        }),
        st('sensor.grid_power', '300', { device_class: 'power', friendly_name: 'Grid Power' }),
        st('sensor.powerwall_charge', '72', {
          device_class: 'battery',
          friendly_name: 'Powerwall',
        }),
      ]),
    );
    expect(summary?.hasSolar).toBe(true);
    expect(summary?.solarW).toBe(2400);
    expect(summary?.gridW).toBe(300);
    expect(summary?.batteryPct).toBe(72);
    expect(summary?.hasBattery).toBe(true);
  });
});

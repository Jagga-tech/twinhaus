import { describe, expect, it } from 'vitest';
import type { HaEntityState } from '@twinhaus/ha-bridge';
import { computeRoomEnergy, entityPowerWatts, heatColor } from './energy.js';
import type { DevicePlacement, Room } from '../store/types.js';

function state(
  entity_id: string,
  s: string,
  attributes: HaEntityState['attributes'] = {},
): HaEntityState {
  return { entity_id, state: s, attributes, last_changed: '', last_updated: '' };
}

describe('entityPowerWatts', () => {
  it('reads a power sensor in W', () => {
    expect(
      entityPowerWatts(
        state('sensor.p', '120', { device_class: 'power', unit_of_measurement: 'W' }),
      ),
    ).toBe(120);
  });
  it('converts kW to W', () => {
    expect(
      entityPowerWatts(
        state('sensor.p', '1.5', { device_class: 'power', unit_of_measurement: 'kW' }),
      ),
    ).toBe(1500);
  });
  it('reads current_power_w attribute', () => {
    expect(entityPowerWatts(state('switch.plug', 'on', { current_power_w: 42 }))).toBe(42);
  });
  it('returns null when there is no power reading', () => {
    expect(entityPowerWatts(state('light.x', 'on'))).toBeNull();
    expect(entityPowerWatts(undefined)).toBeNull();
  });
});

describe('computeRoomEnergy', () => {
  it('aggregates power per room', () => {
    const rooms: Room[] = [
      { id: 'r1', name: 'Living', polygon: [], height: 2.6 },
      { id: 'r2', name: 'Kitchen', polygon: [], height: 2.6 },
    ];
    const devices: DevicePlacement[] = [
      { entityId: 'sensor.a', roomId: 'r1', position: { x: 0, z: 0 } },
      { entityId: 'sensor.b', roomId: 'r1', position: { x: 0, z: 0 } },
      { entityId: 'sensor.c', roomId: 'r2', position: { x: 0, z: 0 } },
    ];
    const states = {
      'sensor.a': state('sensor.a', '100', { device_class: 'power', unit_of_measurement: 'W' }),
      'sensor.b': state('sensor.b', '50', { device_class: 'power', unit_of_measurement: 'W' }),
      'sensor.c': state('sensor.c', '200', { device_class: 'power', unit_of_measurement: 'W' }),
    };
    const energy = computeRoomEnergy(rooms, devices, states);
    expect(energy.byRoom.r1).toBe(150);
    expect(energy.byRoom.r2).toBe(200);
    expect(energy.max).toBe(200);
    expect(energy.total).toBe(350);
  });
});

describe('heatColor', () => {
  it('maps 0 to green and 1 to red', () => {
    expect(heatColor(0)).toBe('rgb(76, 175, 80)');
    expect(heatColor(1)).toBe('rgb(229, 57, 53)');
  });
  it('clamps out-of-range input', () => {
    expect(heatColor(-1)).toBe(heatColor(0));
    expect(heatColor(2)).toBe(heatColor(1));
  });
});

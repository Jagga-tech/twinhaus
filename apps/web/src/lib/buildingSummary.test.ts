import { describe, expect, it } from 'vitest';
import type { HaEntityState } from '@twinhaus/ha-bridge';
import type { DevicePlacement, Level, Room } from '../store/types.js';
import { buildingSummary } from './buildingSummary.js';

const levels: Level[] = [
  { id: 'g', name: 'Ground', order: 0 },
  { id: 'u', name: 'Upstairs', order: 1 },
];
const square = [
  { x: 0, z: 0 },
  { x: 2, z: 0 },
  { x: 2, z: 2 },
  { x: 0, z: 2 },
];
const rooms: Room[] = [
  { id: 'r_living', name: 'Living', height: 2.6, levelId: 'g', polygon: square },
  { id: 'r_kitchen', name: 'Kitchen', height: 2.6, levelId: 'g', polygon: square },
  { id: 'r_bed', name: 'Bedroom', height: 2.6, levelId: 'u', polygon: square },
];
const devices: DevicePlacement[] = [
  { entityId: 'light.a', roomId: 'r_living', position: { x: 1, z: 1 } },
  { entityId: 'sensor.power', roomId: 'r_living', position: { x: 1, z: 1 } },
  { entityId: 'light.b', roomId: 'r_bed', position: { x: 1, z: 1 } },
];
const states: Record<string, HaEntityState> = {
  'sensor.power': {
    entity_id: 'sensor.power',
    state: '120',
    attributes: { device_class: 'power', unit_of_measurement: 'W' },
    last_changed: '',
    last_updated: '',
  } as HaEntityState,
};

describe('buildingSummary', () => {
  it('counts rooms and devices per floor', () => {
    const s = buildingSummary(levels, rooms, devices, states);
    const ground = s.levels.find((l) => l.level.id === 'g')!;
    const up = s.levels.find((l) => l.level.id === 'u')!;
    expect(ground.roomCount).toBe(2);
    expect(ground.deviceCount).toBe(2);
    expect(up.roomCount).toBe(1);
    expect(up.deviceCount).toBe(1);
  });

  it('attributes power to the floor the sensor sits on', () => {
    const s = buildingSummary(levels, rooms, devices, states);
    expect(s.levels.find((l) => l.level.id === 'g')!.watts).toBe(120);
    expect(s.levels.find((l) => l.level.id === 'u')!.watts).toBe(0);
  });

  it('rolls up building-wide totals ordered by storey', () => {
    const s = buildingSummary(levels, rooms, devices, states);
    expect(s.levels.map((l) => l.level.name)).toEqual(['Ground', 'Upstairs']);
    expect(s.totalRooms).toBe(3);
    expect(s.totalDevices).toBe(3);
    expect(s.totalWatts).toBe(120);
    expect(s.floorCount).toBe(2);
  });
});

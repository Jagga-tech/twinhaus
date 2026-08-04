import { describe, expect, it } from 'vitest';
import type { HaEntityState } from '@twinhaus/ha-bridge';
import type { PositionEstimate } from './positioning.js';
import type { Room } from '../store/types.js';
import { occupiedRoomCount, roomPresence } from './presence.js';

const rooms: Room[] = [
  {
    id: 'living',
    name: 'Living Room',
    height: 2.4,
    polygon: [
      { x: 0, z: 0 },
      { x: 4, z: 0 },
      { x: 4, z: 4 },
      { x: 0, z: 4 },
    ],
  },
];

const est = (x: number, z: number): PositionEstimate => ({
  position: { x, z },
  confidence: 1,
  method: 'trilateration',
});

const states: Record<string, HaEntityState> = {
  'person.sam': {
    entity_id: 'person.sam',
    state: 'home',
    attributes: { friendly_name: 'Sam' },
    last_changed: '',
    last_updated: '',
  },
};

describe('roomPresence', () => {
  it('resolves a tracked person to the room they are standing in', () => {
    const presence = roomPresence(rooms, { 'person.sam': est(2, 2) }, states);
    expect(presence).toHaveLength(1);
    expect(presence[0].label).toBe('Sam');
    expect(presence[0].roomName).toBe('Living Room');
  });

  it('reports no room when the position is outside every room', () => {
    const presence = roomPresence(rooms, { 'person.sam': est(9, 9) }, states);
    expect(presence[0].roomId).toBeNull();
  });

  it('ignores non-people targets like a phone-less sensor', () => {
    const presence = roomPresence(rooms, { 'light.lamp': est(2, 2) }, states);
    expect(presence).toEqual([]);
  });

  it('counts distinct occupied rooms', () => {
    const presence = roomPresence(
      rooms,
      { 'person.sam': est(2, 2), 'device_tracker.phone': est(1, 1) },
      states,
    );
    expect(occupiedRoomCount(presence)).toBe(1);
  });
});

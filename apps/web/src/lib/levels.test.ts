import { describe, expect, it } from 'vitest';
import type { Room, TwinModel } from '../store/types.js';
import {
  BUILDING_TYPES,
  DEFAULT_LEVEL,
  buildingToTwin,
  devicesOnLevel,
  normalizeLevels,
  roomLevelId,
  roomsOnLevel,
  sortedLevels,
} from './levels.js';

const room = (id: string, levelId?: string): Room => ({
  id,
  name: id,
  height: 2.6,
  levelId,
  polygon: [
    { x: 0, z: 0 },
    { x: 1, z: 0 },
    { x: 1, z: 1 },
  ],
});

describe('roomLevelId / roomsOnLevel', () => {
  it('treats an unset levelId as the default ground floor', () => {
    expect(roomLevelId(room('a'))).toBe(DEFAULT_LEVEL.id);
    const rooms = [room('a'), room('b', 'level_first'), room('c', DEFAULT_LEVEL.id)];
    expect(roomsOnLevel(rooms, DEFAULT_LEVEL.id).map((r) => r.id)).toEqual(['a', 'c']);
    expect(roomsOnLevel(rooms, 'level_first').map((r) => r.id)).toEqual(['b']);
  });
});

describe('devicesOnLevel', () => {
  it('keeps only placements whose room sits on the level', () => {
    const rooms = [room('r1', 'g'), room('r2', 'up')];
    const placements = [
      { entityId: 'light.a', roomId: 'r1' },
      { entityId: 'light.b', roomId: 'r2' },
    ];
    expect(devicesOnLevel(placements, rooms, 'g').map((p) => p.entityId)).toEqual(['light.a']);
  });
});

describe('sortedLevels', () => {
  it('orders by storey number ascending', () => {
    const levels = [
      { id: 'b', name: 'First', order: 1 },
      { id: 'a', name: 'Ground', order: 0 },
      { id: 'c', name: 'Basement', order: -1 },
    ];
    expect(sortedLevels(levels).map((l) => l.name)).toEqual(['Basement', 'Ground', 'First']);
  });
});

describe('normalizeLevels', () => {
  it('adds a default level when none exist', () => {
    const model: TwinModel = { version: 1, rooms: [room('a')], devices: [], virtualDevices: [] };
    const out = normalizeLevels(model);
    expect(out.levels).toEqual([DEFAULT_LEVEL]);
    expect(out.rooms[0].levelId).toBe(DEFAULT_LEVEL.id);
  });

  it('reassigns rooms whose levelId points at a missing level', () => {
    const model: TwinModel = {
      version: 1,
      rooms: [room('a', 'ghost'), room('b', 'up')],
      devices: [],
      virtualDevices: [],
      levels: [
        { id: 'ground', name: 'Ground', order: 0 },
        { id: 'up', name: 'Up', order: 1 },
      ],
    };
    const out = normalizeLevels(model);
    expect(out.rooms.find((r) => r.id === 'a')?.levelId).toBe('ground'); // dangling to first
    expect(out.rooms.find((r) => r.id === 'b')?.levelId).toBe('up'); // valid kept
  });
});

describe('buildingToTwin', () => {
  it('materializes a multi-storey building with one level per floor', () => {
    const twostorey = BUILDING_TYPES.find((b) => b.id === 'two-storey')!;
    const twin = buildingToTwin(twostorey);
    expect(twin.levels).toHaveLength(2);
    // every room references a real level, and level ids are unique
    const levelIds = new Set(twin.levels!.map((l) => l.id));
    expect(twin.rooms.every((r) => r.levelId && levelIds.has(r.levelId))).toBe(true);
    expect(new Set(twin.rooms.map((r) => r.id)).size).toBe(twin.rooms.length);
  });

  it('keeps the bungalow to a single floor', () => {
    const twin = buildingToTwin(BUILDING_TYPES.find((b) => b.id === 'bungalow')!);
    expect(twin.levels).toHaveLength(1);
  });
});

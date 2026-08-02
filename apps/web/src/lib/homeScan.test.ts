import { describe, expect, it } from 'vitest';
import type { RawArea, RawDeviceRegistryEntry, RawEntityRegistryEntry } from '@twinhaus/ha-bridge';
import { applyReview, buildHomeScan, packAreasIntoRooms, resolveEntityArea } from './homeScan.js';

const areas: RawArea[] = [
  { area_id: 'living', name: 'Living Room' },
  { area_id: 'kitchen', name: 'Kitchen' },
  { area_id: 'hall', name: 'Hall' },
];

describe('packAreasIntoRooms', () => {
  it('makes one labeled room per area, deterministically', () => {
    const rooms = packAreasIntoRooms(areas);
    expect(rooms.map((r) => r.name)).toEqual(['Living Room', 'Kitchen', 'Hall']);
    expect(rooms.map((r) => r.id)).toEqual(['scan_living', 'scan_kitchen', 'scan_hall']);
    // Same input to same layout (no randomness or clock).
    expect(packAreasIntoRooms(areas)).toEqual(rooms);
  });

  it('gives every room a 4-corner polygon', () => {
    for (const room of packAreasIntoRooms(areas)) {
      expect(room.polygon).toHaveLength(4);
    }
  });

  it('does not overlap adjacent rooms in the grid', () => {
    const [a, b] = packAreasIntoRooms(areas);
    const aMaxX = Math.max(...a.polygon.map((p) => p.x));
    const bMinX = Math.min(...b.polygon.map((p) => p.x));
    expect(bMinX).toBeGreaterThanOrEqual(aMaxX);
  });
});

describe('resolveEntityArea', () => {
  const deviceAreas = new Map([['dev1', 'kitchen']]);

  it("prefers the entity's own area over its device's", () => {
    const entity: RawEntityRegistryEntry = {
      entity_id: 'light.x',
      device_id: 'dev1',
      area_id: 'living',
    };
    expect(resolveEntityArea(entity, deviceAreas)).toBe('living');
  });

  it("falls back to the device's area", () => {
    const entity: RawEntityRegistryEntry = { entity_id: 'light.x', device_id: 'dev1' };
    expect(resolveEntityArea(entity, deviceAreas)).toBe('kitchen');
  });

  it('returns null when neither has an area', () => {
    expect(resolveEntityArea({ entity_id: 'light.x' }, deviceAreas)).toBeNull();
  });
});

describe('buildHomeScan', () => {
  const devices: RawDeviceRegistryEntry[] = [
    { id: 'dev_tv', area_id: 'living' },
    { id: 'dev_fridge', area_id: 'kitchen' },
  ];
  const entities: RawEntityRegistryEntry[] = [
    { entity_id: 'light.tv_backlight', device_id: 'dev_tv' },
    { entity_id: 'media_player.tv', device_id: 'dev_tv' },
    { entity_id: 'switch.fridge', device_id: 'dev_fridge' },
    { entity_id: 'lock.front', area_id: 'hall' },
    { entity_id: 'sensor.no_area' },
    { entity_id: 'update.firmware', device_id: 'dev_tv' },
  ];

  it('places each device in the room of its area', () => {
    const { model } = buildHomeScan(areas, devices, entities);
    const byEntity = new Map(model.devices.map((d) => [d.entityId, d.roomId]));
    expect(byEntity.get('light.tv_backlight')).toBe('scan_living');
    expect(byEntity.get('media_player.tv')).toBe('scan_living');
    expect(byEntity.get('switch.fridge')).toBe('scan_kitchen');
    expect(byEntity.get('lock.front')).toBe('scan_hall');
  });

  it('skips entities without an area and non-placeable domains', () => {
    const result = buildHomeScan(areas, devices, entities);
    const placed = result.model.devices.map((d) => d.entityId);
    expect(placed).not.toContain('sensor.no_area');
    expect(placed).not.toContain('update.firmware');
    expect(result.skippedCount).toBe(1); // sensor.no_area; update.* isn't placeable so isn't counted
  });

  it('reports room and placement counts and spreads devices sharing a room', () => {
    const result = buildHomeScan(areas, devices, entities);
    expect(result.roomCount).toBe(3);
    expect(result.placedCount).toBe(4);
    const living = result.model.devices.filter((d) => d.roomId === 'scan_living');
    expect(living[0].position).not.toEqual(living[1].position);
  });
});

describe('buildHomeScan with floors', () => {
  it('creates a level per floor and tags each room with its floor', () => {
    const floors = [
      { floor_id: 'f_ground', name: 'Ground', level: 0 },
      { floor_id: 'f_first', name: 'First', level: 1 },
    ];
    const floorAreas = [
      { area_id: 'living', name: 'Living Room', floor_id: 'f_ground' },
      { area_id: 'kitchen', name: 'Kitchen', floor_id: 'f_ground' },
      { area_id: 'bed', name: 'Bedroom', floor_id: 'f_first' },
    ];
    const result = buildHomeScan(floorAreas, [], [], floors);
    expect(result.model.levels?.map((l) => l.name)).toEqual(['Ground', 'First']);
    const byRoom = new Map(result.model.rooms.map((r) => [r.name, r.levelId]));
    expect(byRoom.get('Living Room')).toBe('scan_f_ground');
    expect(byRoom.get('Bedroom')).toBe('scan_f_first');
  });

  it('falls back to a single Home level when no floors are defined', () => {
    const result = buildHomeScan(areas, [], []);
    expect(result.model.levels).toHaveLength(1);
    expect(result.model.levels?.[0].name).toBe('Home');
    expect(result.model.rooms.every((r) => r.levelId === 'scan_home')).toBe(true);
  });
});

describe('applyReview', () => {
  const result = buildHomeScan(
    areas,
    [{ id: 'dev_tv', area_id: 'living' }],
    [
      { entity_id: 'light.tv_backlight', device_id: 'dev_tv' },
      { entity_id: 'lock.front', area_id: 'hall' },
    ],
  );

  it('passes through unchanged with an empty review', () => {
    const model = applyReview(result);
    expect(model.rooms).toHaveLength(3);
    expect(model.devices.map((d) => d.entityId).sort()).toEqual([
      'light.tv_backlight',
      'lock.front',
    ]);
  });

  it('renames a room without changing its id', () => {
    const model = applyReview(result, {
      roomNames: { scan_living: 'Lounge' },
      assignments: {},
      excluded: [],
    });
    const room = model.rooms.find((r) => r.id === 'scan_living');
    expect(room?.name).toBe('Lounge');
  });

  it('reassigns a device to another room', () => {
    const model = applyReview(result, {
      roomNames: {},
      assignments: { 'light.tv_backlight': 'scan_kitchen' },
      excluded: [],
    });
    const placement = model.devices.find((d) => d.entityId === 'light.tv_backlight');
    expect(placement?.roomId).toBe('scan_kitchen');
  });

  it('drops excluded devices', () => {
    const model = applyReview(result, { roomNames: {}, assignments: {}, excluded: ['lock.front'] });
    expect(model.devices.map((d) => d.entityId)).not.toContain('lock.front');
    expect(model.devices).toHaveLength(1);
  });

  it('ignores an assignment to a non-existent room', () => {
    const model = applyReview(result, {
      roomNames: {},
      assignments: { 'lock.front': 'scan_nope' },
      excluded: [],
    });
    expect(model.devices.find((d) => d.entityId === 'lock.front')).toBeUndefined();
  });
});

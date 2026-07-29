import { describe, expect, it } from 'vitest';
import type { RawArea, RawDeviceRegistryEntry, RawEntityRegistryEntry } from '@twinhaus/ha-bridge';
import { buildHomeScan, packAreasIntoRooms, resolveEntityArea } from './homeScan.js';

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
    // Same input → same layout (no randomness or clock).
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

  it('prefers the entity’s own area over its device’s', () => {
    const entity: RawEntityRegistryEntry = {
      entity_id: 'light.x',
      device_id: 'dev1',
      area_id: 'living',
    };
    expect(resolveEntityArea(entity, deviceAreas)).toBe('living');
  });

  it('falls back to the device’s area', () => {
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

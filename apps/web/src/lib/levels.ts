import type { Level, Point2D, Room, TwinModel } from '../store/types.js';

/** The implicit ground floor every twin has before anyone adds more storeys. */
export const DEFAULT_LEVEL: Level = { id: 'level_ground', name: 'Ground floor', order: 0 };

/** The level a room belongs to, treating an unset `levelId` as the default ground floor. */
export function roomLevelId(room: Room): string {
  return room.levelId ?? DEFAULT_LEVEL.id;
}

/** Rooms on one level (unset `levelId` counts as the default ground floor). */
export function roomsOnLevel(rooms: Room[], levelId: string): Room[] {
  return rooms.filter((room) => roomLevelId(room) === levelId);
}

/** Device placements whose room sits on the given level. */
export function devicesOnLevel<T extends { roomId: string }>(
  placements: T[],
  rooms: Room[],
  levelId: string,
): T[] {
  const onLevel = new Set(roomsOnLevel(rooms, levelId).map((room) => room.id));
  return placements.filter((placement) => onLevel.has(placement.roomId));
}

/** Levels sorted lowest-storey-first for a consistent switcher order. */
export function sortedLevels(levels: Level[]): Level[] {
  return [...levels].sort((a, b) => a.order - b.order);
}

/** Vertical gap between stacked storeys, in meters (wall height + a little slab). */
export const LEVEL_GAP = 3.4;

/** Height a level sits at in the stacked 3D view — its index in storey order × the gap. */
export function levelElevation(levels: Level[], levelId: string): number {
  const index = sortedLevels(levels).findIndex((level) => level.id === levelId);
  return Math.max(0, index) * LEVEL_GAP;
}

/**
 * Normalize a twin document's levels: guarantee at least one level and that every room references
 * one that exists (rooms with a dangling or missing `levelId` fall back to the first level).
 */
export function normalizeLevels(model: TwinModel): { levels: Level[]; rooms: Room[] } {
  const levels = model.levels && model.levels.length > 0 ? model.levels : [DEFAULT_LEVEL];
  const ids = new Set(levels.map((level) => level.id));
  const fallback = sortedLevels(levels)[0].id;
  const rooms = model.rooms.map((room) =>
    room.levelId && ids.has(room.levelId) ? room : { ...room, levelId: fallback },
  );
  return { levels, rooms };
}

function rect(x: number, z: number, w: number, d: number): Point2D[] {
  return [
    { x, z },
    { x: x + w, z },
    { x: x + w, z: z + d },
    { x, z: z + d },
  ];
}

interface BuildingRoom {
  name: string;
  x: number;
  z: number;
  w: number;
  d: number;
}
interface BuildingFloor {
  name: string;
  rooms: BuildingRoom[];
}
export interface BuildingType {
  id: string;
  name: string;
  description: string;
  floors: BuildingFloor[];
}

/**
 * Starter structures for a whole house, spanning one to three storeys. Materialized with
 * {@link buildingToTwin} into a {@link TwinModel} the store can import — the multi-floor answer to
 * the single-floor templates.
 */
export const BUILDING_TYPES: BuildingType[] = [
  {
    id: 'bungalow',
    name: 'Bungalow',
    description: 'Single storey — living, kitchen, two beds, bath.',
    floors: [
      {
        name: 'Ground floor',
        rooms: [
          { name: 'Living Room', x: -6, z: -4, w: 6, d: 5 },
          { name: 'Kitchen', x: 0, z: -4, w: 4, d: 5 },
          { name: 'Bedroom 1', x: -6, z: 1, w: 5, d: 4 },
          { name: 'Bedroom 2', x: -1, z: 1, w: 5, d: 4 },
          { name: 'Bathroom', x: 4, z: -4, w: 3, d: 3 },
        ],
      },
    ],
  },
  {
    id: 'two-storey',
    name: 'Two-storey house',
    description: 'Ground living space + upstairs bedrooms.',
    floors: [
      {
        name: 'Ground floor',
        rooms: [
          { name: 'Living Room', x: -6, z: -4, w: 6, d: 5 },
          { name: 'Kitchen', x: 0, z: -4, w: 5, d: 5 },
          { name: 'Hall', x: -6, z: 1, w: 4, d: 3 },
          { name: 'Garage', x: -2, z: 1, w: 5, d: 4 },
        ],
      },
      {
        name: 'First floor',
        rooms: [
          { name: 'Primary Bedroom', x: -6, z: -4, w: 6, d: 5 },
          { name: 'Bedroom 2', x: 0, z: -4, w: 5, d: 5 },
          { name: 'Bathroom', x: -6, z: 1, w: 4, d: 3 },
          { name: 'Landing', x: -2, z: 1, w: 5, d: 3 },
        ],
      },
    ],
  },
  {
    id: 'townhouse',
    name: 'Townhouse',
    description: 'Three narrow storeys, garage to loft.',
    floors: [
      {
        name: 'Ground floor',
        rooms: [
          { name: 'Garage', x: -4, z: -4, w: 5, d: 5 },
          { name: 'Hall', x: 1, z: -4, w: 3, d: 5 },
          { name: 'Utility', x: -4, z: 1, w: 8, d: 3 },
        ],
      },
      {
        name: 'First floor',
        rooms: [
          { name: 'Living Room', x: -4, z: -4, w: 8, d: 5 },
          { name: 'Kitchen', x: -4, z: 1, w: 8, d: 3 },
        ],
      },
      {
        name: 'Second floor',
        rooms: [
          { name: 'Primary Bedroom', x: -4, z: -4, w: 5, d: 5 },
          { name: 'Bedroom 2', x: 1, z: -4, w: 3, d: 5 },
          { name: 'Bathroom', x: -4, z: 1, w: 8, d: 3 },
        ],
      },
    ],
  },
];

/** Materialize a {@link BuildingType} into an importable {@link TwinModel} with stacked levels. */
export function buildingToTwin(building: BuildingType): TwinModel {
  const levels: Level[] = building.floors.map((floor, index) => ({
    id: `${building.id}_l${index}`,
    name: floor.name,
    order: index,
  }));
  const rooms: Room[] = building.floors.flatMap((floor, floorIndex) =>
    floor.rooms.map((room, roomIndex) => ({
      id: `${building.id}_l${floorIndex}_r${roomIndex}`,
      name: room.name,
      height: 2.6,
      levelId: levels[floorIndex].id,
      polygon: rect(room.x, room.z, room.w, room.d),
    })),
  );
  return { version: 1, rooms, devices: [], virtualDevices: [], levels };
}

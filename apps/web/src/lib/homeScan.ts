import type {
  RawArea,
  RawDeviceRegistryEntry,
  RawEntityRegistryEntry,
  RawFloor,
} from '@twinhaus/ha-bridge';
import { entityDomain } from '@twinhaus/ha-bridge';
import type { DevicePlacement, Level, Point2D, Room, TwinModel } from '../store/types.js';
import { polygonCentroid } from './geometry.js';

/**
 * Domains worth placing in the twin. Home Assistant surfaces hundreds of diagnostic entities per
 * device; we only drop the ones a person thinks of as "a device in a room" so the scan reads clean.
 */
const PLACEABLE_DOMAINS = new Set([
  'light',
  'switch',
  'lock',
  'climate',
  'cover',
  'camera',
  'media_player',
  'fan',
  'binary_sensor',
  'sensor',
  'vacuum',
]);

const ROOM_W = 4;
const ROOM_D = 4;
const GAP = 0.6;
const WALL_HEIGHT = 2.6;

export interface HomeScanResult {
  model: TwinModel;
  roomCount: number;
  placedCount: number;
  /** Placeable entities that had no resolvable area, so they couldn't be auto-placed. */
  skippedCount: number;
}

/** Axis-aligned rectangle polygon, clockwise from the top-left corner. */
function rect(x: number, z: number, w: number, d: number): Point2D[] {
  return [
    { x, z },
    { x: x + w, z },
    { x: x + w, z: z + d },
    { x, z: z + d },
  ];
}

/**
 * Pack one labeled rectangle per area into a centered grid. Deterministic, no randomness or
 * clock, so the same home always scans to the same layout, and it's a starting point the user
 * nudges in the editor, not a claim of real geometry.
 */
export function packAreasIntoRooms(
  areas: Array<{ area_id: string; name: string }>,
  levelId?: string,
): Room[] {
  const columns = Math.max(1, Math.ceil(Math.sqrt(areas.length)));
  const rows = Math.ceil(areas.length / columns);
  const totalWidth = columns * ROOM_W + (columns - 1) * GAP;
  const totalDepth = rows * ROOM_D + (rows - 1) * GAP;
  const offsetX = -totalWidth / 2;
  const offsetZ = -totalDepth / 2;

  return areas.map((area, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = offsetX + column * (ROOM_W + GAP);
    const z = offsetZ + row * (ROOM_D + GAP);
    return {
      id: `scan_${area.area_id}`,
      name: area.name,
      height: WALL_HEIGHT,
      levelId,
      polygon: rect(x, z, ROOM_W, ROOM_D),
    };
  });
}

/** Resolve an entity's area: its own assignment wins, else it inherits its device's area. */
export function resolveEntityArea(
  entity: RawEntityRegistryEntry,
  deviceAreaById: Map<string, string>,
): string | null {
  if (entity.area_id) return entity.area_id;
  if (entity.device_id) return deviceAreaById.get(entity.device_id) ?? null;
  return null;
}

/** Spread devices in a room around its center so several in one room don't stack on one point. */
function spreadInRoom(center: Point2D, indexInRoom: number): Point2D {
  const perRow = 3;
  const spacing = 0.7;
  const column = indexInRoom % perRow;
  const row = Math.floor(indexInRoom / perRow);
  return {
    x: center.x + (column - (perRow - 1) / 2) * spacing,
    z: center.z + (row - 1) * spacing,
  };
}

/**
 * Turn Home Assistant's area, device, and entity registries into a ready-to-import {@link TwinModel}:
 * a room per area and every placeable entity dropped into the room its device belongs to. This is
 * the "I don't want to draw" path, HA already knows the rooms and where each device lives.
 */
export function buildHomeScan(
  areas: RawArea[],
  devices: RawDeviceRegistryEntry[],
  entities: RawEntityRegistryEntry[],
  floors: RawFloor[] = [],
): HomeScanResult {
  const floorById = new Map(floors.map((floor) => [floor.floor_id, floor]));
  const HOME = '__home';
  const levelKey = (area: RawArea) =>
    area.floor_id && floorById.has(area.floor_id) ? area.floor_id : HOME;

  // One level per floor actually used by an area, ordered by the floor's storey number.
  const usedKeys = [...new Set(areas.map(levelKey))];
  const levels: Level[] = usedKeys.map((key, index) => {
    if (key === HOME) {
      return { id: 'scan_home', name: floors.length > 0 ? 'Unassigned' : 'Home', order: 1000 };
    }
    const floor = floorById.get(key)!;
    return { id: `scan_${key}`, name: floor.name, order: floor.level ?? index };
  });
  const levelIdForKey = new Map(usedKeys.map((key, i) => [key, levels[i].id]));

  // Pack each floor's areas into its own grid (floors overlap in space, only one shows at a time).
  const rooms: Room[] = [];
  const roomByAreaId = new Map<string, Room>();
  for (const key of usedKeys) {
    const floorAreas = areas.filter((area) => levelKey(area) === key);
    const packed = packAreasIntoRooms(floorAreas, levelIdForKey.get(key));
    packed.forEach((room, index) => {
      rooms.push(room);
      roomByAreaId.set(floorAreas[index].area_id, room);
    });
  }
  const centroidByRoomId = new Map(rooms.map((room) => [room.id, polygonCentroid(room.polygon)]));

  const deviceAreaById = new Map<string, string>();
  for (const device of devices) {
    if (device.area_id) deviceAreaById.set(device.id, device.area_id);
  }

  const placements: DevicePlacement[] = [];
  const countInRoom = new Map<string, number>();
  let skippedCount = 0;

  for (const entity of entities) {
    if (!PLACEABLE_DOMAINS.has(entityDomain(entity.entity_id))) continue;
    const areaId = resolveEntityArea(entity, deviceAreaById);
    const room = areaId ? roomByAreaId.get(areaId) : undefined;
    if (!room) {
      skippedCount += 1;
      continue;
    }
    const indexInRoom = countInRoom.get(room.id) ?? 0;
    countInRoom.set(room.id, indexInRoom + 1);
    placements.push({
      entityId: entity.entity_id,
      roomId: room.id,
      position: spreadInRoom(centroidByRoomId.get(room.id)!, indexInRoom),
    });
  }

  return {
    model: { version: 1, rooms, devices: placements, virtualDevices: [], levels },
    roomCount: rooms.length,
    placedCount: placements.length,
    skippedCount,
  };
}

/** User edits to a scan before applying it: rename rooms, move a device, or drop one entirely. */
export interface ScanReview {
  /** roomId to new name. */
  roomNames: Record<string, string>;
  /** entityId to the roomId it should live in (overrides the auto-assignment). */
  assignments: Record<string, string>;
  /** entityIds to leave out of the twin. */
  excluded: string[];
}

const EMPTY_REVIEW: ScanReview = { roomNames: {}, assignments: {}, excluded: [] };

/**
 * Apply a user's {@link ScanReview} to a scan result, producing the final {@link TwinModel}. Rooms
 * keep their identity (only names change); each device lands in its reviewed room with positions
 * re-spread so a move looks tidy; excluded devices drop out. Pure, so the review UI stays testable.
 */
export function applyReview(result: HomeScanResult, review: ScanReview = EMPTY_REVIEW): TwinModel {
  const excluded = new Set(review.excluded);
  const rooms = result.model.rooms.map((room) => ({
    ...room,
    name: review.roomNames[room.id] ?? room.name,
  }));
  const roomIds = new Set(rooms.map((room) => room.id));
  const centroidByRoomId = new Map(rooms.map((room) => [room.id, polygonCentroid(room.polygon)]));

  const placements: DevicePlacement[] = [];
  const countInRoom = new Map<string, number>();
  for (const placement of result.model.devices) {
    if (excluded.has(placement.entityId)) continue;
    const roomId = review.assignments[placement.entityId] ?? placement.roomId;
    if (!roomIds.has(roomId)) continue;
    const indexInRoom = countInRoom.get(roomId) ?? 0;
    countInRoom.set(roomId, indexInRoom + 1);
    placements.push({
      entityId: placement.entityId,
      roomId,
      position: spreadInRoom(centroidByRoomId.get(roomId)!, indexInRoom),
    });
  }

  return {
    version: 1,
    rooms,
    devices: placements,
    virtualDevices: [],
    levels: result.model.levels,
  };
}

import type { HaEntityState } from '@twinhaus/ha-bridge';
import type { DevicePlacement, Level, Room } from '../store/types.js';
import { computeRoomEnergy } from './energy.js';
import { devicesOnLevel, roomsOnLevel, sortedLevels } from './levels.js';

export interface LevelSummary {
  level: Level;
  roomCount: number;
  deviceCount: number;
  watts: number;
}

export interface BuildingSummary {
  levels: LevelSummary[];
  totalRooms: number;
  totalDevices: number;
  totalWatts: number;
  floorCount: number;
}

/**
 * Roll up the whole house: per-floor room/device counts and power draw, plus building-wide totals.
 * Pure, so the summary panel stays testable, power comes from the same {@link computeRoomEnergy}
 * the heatmap uses, scoped to each floor's rooms.
 */
export function buildingSummary(
  levels: Level[],
  rooms: Room[],
  devices: DevicePlacement[],
  entityStates: Record<string, HaEntityState>,
): BuildingSummary {
  const perLevel = sortedLevels(levels).map((level) => {
    const levelRooms = roomsOnLevel(rooms, level.id);
    const levelDevices = devicesOnLevel(devices, rooms, level.id);
    const energy = computeRoomEnergy(levelRooms, levelDevices, entityStates);
    return {
      level,
      roomCount: levelRooms.length,
      deviceCount: levelDevices.length,
      watts: Math.round(energy.total),
    };
  });

  return {
    levels: perLevel,
    totalRooms: perLevel.reduce((sum, l) => sum + l.roomCount, 0),
    totalDevices: perLevel.reduce((sum, l) => sum + l.deviceCount, 0),
    totalWatts: perLevel.reduce((sum, l) => sum + l.watts, 0),
    floorCount: levels.length,
  };
}

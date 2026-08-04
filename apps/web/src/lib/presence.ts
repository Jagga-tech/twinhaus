import { entityDomain, type HaEntityState } from '@twinhaus/ha-bridge';
import type { PositionEstimate } from './positioning.js';
import type { Room } from '../store/types.js';
import { roomAt } from './geometry.js';
import { entityLabel } from './deviceState.js';

/** Where a tracked person or device currently is, resolved to a room. */
export interface Presence {
  entityId: string;
  label: string;
  roomId: string | null;
  roomName: string | null;
}

/**
 * Resolve room-level presence from live positions: for each tracked target with an estimate, find
 * which room its (x, z) falls in. This is "who is where" without any extra hardware beyond the
 * distance proxies positioning already uses. Pure, so it is easy to test.
 */
export function roomPresence(
  rooms: Room[],
  livePositions: Record<string, PositionEstimate>,
  entityStates: Record<string, HaEntityState>,
): Presence[] {
  const presence: Presence[] = [];
  for (const [entityId, estimate] of Object.entries(livePositions)) {
    // Focus on people/phones/trackers; other located devices are noise for a "who is home" view.
    const domain = entityDomain(entityId);
    if (domain !== 'device_tracker' && domain !== 'person') continue;
    const room = roomAt(estimate.position, rooms);
    presence.push({
      entityId,
      label: entityLabel(entityId, entityStates[entityId]),
      roomId: room?.id ?? null,
      roomName: room?.name ?? null,
    });
  }
  return presence;
}

/** Count of distinct occupied rooms, for a quick "3 people across 2 rooms" style summary. */
export function occupiedRoomCount(presence: Presence[]): number {
  return new Set(presence.map((p) => p.roomId).filter((id): id is string => id != null)).size;
}

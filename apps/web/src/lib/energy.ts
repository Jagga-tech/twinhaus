import type { HaEntityState } from '@twinhaus/ha-bridge';
import type { DevicePlacement, Room } from '../store/types.js';

/**
 * Best-effort instantaneous power draw for an entity, in watts. Reads a `power` sensor's value
 * or a switch/plug's `current_power_w` attribute, the shapes Emporia, Shelly, and most HA
 * energy integrations expose.
 */
export function entityPowerWatts(state: HaEntityState | undefined): number | null {
  if (!state) return null;

  const attrPower = state.attributes.current_power_w;
  if (typeof attrPower === 'number') return attrPower;

  const deviceClass = state.attributes.device_class;
  const unit = state.attributes.unit_of_measurement;
  const value = Number(state.state);
  if (deviceClass === 'power' && Number.isFinite(value)) {
    return unit === 'kW' ? value * 1000 : value;
  }
  return null;
}

export interface RoomEnergy {
  byRoom: Record<string, number>;
  max: number;
  total: number;
}

/** Aggregate live power draw per room, so the heatmap can shade floors by consumption. */
export function computeRoomEnergy(
  rooms: Room[],
  devices: DevicePlacement[],
  entityStates: Record<string, HaEntityState>,
): RoomEnergy {
  const byRoom: Record<string, number> = {};
  for (const room of rooms) byRoom[room.id] = 0;

  for (const device of devices) {
    const watts = entityPowerWatts(entityStates[device.entityId]);
    if (watts && byRoom[device.roomId] !== undefined) byRoom[device.roomId] += watts;
  }

  const values = Object.values(byRoom);
  const max = values.reduce((acc, v) => Math.max(acc, v), 0);
  const total = values.reduce((acc, v) => acc + v, 0);
  return { byRoom, max, total };
}

/** Map a normalized 0..1 intensity to a green→amber→red heatmap color. */
export function heatColor(intensity: number): string {
  const t = Math.max(0, Math.min(1, intensity));
  // green (76,175,80) → amber (255,193,7) → red (229,57,53)
  const stops =
    t < 0.5
      ? lerp([76, 175, 80], [255, 193, 7], t / 0.5)
      : lerp([255, 193, 7], [229, 57, 53], (t - 0.5) / 0.5);
  return `rgb(${stops[0]}, ${stops[1]}, ${stops[2]})`;
}

function lerp(a: number[], b: number[], t: number): number[] {
  return a.map((v, i) => Math.round(v + (b[i] - v) * t));
}

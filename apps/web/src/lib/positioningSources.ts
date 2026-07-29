import type { HaEntityState } from '@twinhaus/ha-bridge';
import type { DevicePlacement } from '../store/types.js';
import {
  type Anchor,
  type DistanceReading,
  type PositionEstimate,
  estimatePosition,
} from './positioning.js';

/**
 * Ingest Home Assistant distance sensors into live position estimates. The contract is deliberately
 * explicit so it works with any ranging integration (ESPHome BT proxies, ESPresense, Bermuda) once
 * its output is shaped to match — rather than guessing one vendor's entity schema:
 *
 *   a distance sensor is a `sensor.*` entity whose attributes carry
 *     - `device_class: 'distance'`
 *     - `anchor`: the entity_id of a device placed in the twin (the fixed reference)
 *     - `target`: the entity_id of the device being located
 *   and whose numeric state (or `attributes.distance`) is the distance in meters.
 *
 * Anchor coordinates come from where the user placed that anchor device in the twin, so no separate
 * calibration step is needed. Entities that don't match are ignored, so the feature is simply inert
 * until a ranging integration is present — it never interferes with a plain setup.
 */
export function deriveLivePositions(
  devices: DevicePlacement[],
  entityStates: Record<string, HaEntityState>,
): Record<string, PositionEstimate> {
  const placementByEntity = new Map(devices.map((device) => [device.entityId, device.position]));

  const anchorsById = new Map<string, Anchor>();
  const readingsByTarget = new Map<string, DistanceReading[]>();

  for (const state of Object.values(entityStates)) {
    const attributes = state.attributes;
    if (attributes.device_class !== 'distance') continue;
    const anchorId = typeof attributes.anchor === 'string' ? attributes.anchor : '';
    const target = typeof attributes.target === 'string' ? attributes.target : '';
    if (!anchorId || !target) continue;

    const anchorPosition = placementByEntity.get(anchorId);
    if (!anchorPosition) continue;

    const raw = typeof attributes.distance === 'number' ? attributes.distance : Number(state.state);
    if (!Number.isFinite(raw)) continue;

    anchorsById.set(anchorId, { id: anchorId, position: anchorPosition });
    const readings = readingsByTarget.get(target) ?? [];
    readings.push({ anchorId, distanceM: raw });
    readingsByTarget.set(target, readings);
  }

  const anchors = [...anchorsById.values()];
  const positions: Record<string, PositionEstimate> = {};
  for (const [target, readings] of readingsByTarget) {
    const estimate = estimatePosition(anchors, readings);
    if (estimate) positions[target] = estimate;
  }
  return positions;
}

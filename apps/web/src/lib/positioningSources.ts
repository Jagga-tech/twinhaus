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
 * its output is shaped to match, rather than guessing one vendor's entity schema:
 *
 *   a distance sensor is a `sensor.*` entity whose attributes carry
 *     - `device_class: 'distance'`
 *     - `anchor`: the entity_id of a device placed in the twin (the fixed reference)
 *     - `target`: the entity_id of the device being located
 *   and whose numeric state (or `attributes.distance`) is the distance in meters.
 *
 * Anchor coordinates come from where the user placed that anchor device in the twin, so no separate
 * calibration step is needed. Entities that don't match are ignored, so the feature is simply inert
 * until a ranging integration is present, it never interferes with a plain setup.
 */
export function deriveLivePositions(
  devices: DevicePlacement[],
  entityStates: Record<string, HaEntityState>,
  /**
   * Environment calibration: raw BLE distances read long through walls and furniture, so this
   * scales every reading before the geometry (0.6 to 1.4, default 1). Tune it until a stationary
   * device's dot lands where the device actually is.
   */
  distanceScale = 1,
): Record<string, PositionEstimate> {
  const placementByEntity = new Map(devices.map((device) => [device.entityId, device.position]));
  const scale = Number.isFinite(distanceScale) && distanceScale > 0 ? distanceScale : 1;

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
    readings.push({ anchorId, distanceM: raw * scale });
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

export interface PositioningStatus {
  /** Whether there's enough to trilaterate: ≥3 placed anchors and at least one tracked device. */
  ready: boolean;
  /** Anchor entity ids referenced by distance sensors. */
  anchorsReferenced: string[];
  /** Referenced anchors that are placed in the twin (so they have coordinates). */
  anchorsPlaced: string[];
  /** Referenced anchors not yet placed, the user needs to drop these in the twin. */
  anchorsMissing: string[];
  /** Devices being located by the distance sensors. */
  targets: string[];
}

/**
 * Report how ready distance-positioning is, to drive a setup helper: which anchors the distance
 * sensors reference, which are placed (and so usable) versus missing, and whether there's enough to
 * trilaterate. Everything is empty when no ranging integration is present.
 */
export function positioningStatus(
  devices: DevicePlacement[],
  entityStates: Record<string, HaEntityState>,
): PositioningStatus {
  const placed = new Set(devices.map((device) => device.entityId));
  const anchorsReferenced = new Set<string>();
  const targets = new Set<string>();

  for (const state of Object.values(entityStates)) {
    const attributes = state.attributes;
    if (attributes.device_class !== 'distance') continue;
    const anchor = typeof attributes.anchor === 'string' ? attributes.anchor : '';
    const target = typeof attributes.target === 'string' ? attributes.target : '';
    if (!anchor || !target) continue;
    anchorsReferenced.add(anchor);
    targets.add(target);
  }

  const anchorsPlaced = [...anchorsReferenced].filter((id) => placed.has(id));
  const anchorsMissing = [...anchorsReferenced].filter((id) => !placed.has(id));
  return {
    ready: anchorsPlaced.length >= 3 && targets.size > 0,
    anchorsReferenced: [...anchorsReferenced],
    anchorsPlaced,
    anchorsMissing,
    targets: [...targets],
  };
}

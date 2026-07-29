import type { Point2D } from '../store/types.js';

/**
 * Positioning "from distance". Home Assistant is still the source — ESPHome Bluetooth proxies (or
 * ESPresense/Bermuda) report how far a device is from each fixed anchor, and this engine turns
 * those distances into a live (x, z) inside the twin. Twinhaus never ranges hardware itself; it
 * only does the geometry on distances HA already publishes.
 *
 * Accuracy is honest: with three or more anchors it trilaterates a point; with one or two it falls
 * back to a proximity blend; with none it declines. Every estimate carries a confidence so the UI
 * can show "roughly here" rather than fake precision.
 */

/** A fixed reference point — a Bluetooth proxy placed in the twin at a known position. */
export interface Anchor {
  id: string;
  position: Point2D;
}

/** How far a tracked device is from one anchor, in meters. */
export interface DistanceReading {
  anchorId: string;
  distanceM: number;
}

export type PositionMethod = 'trilateration' | 'proximity';

export interface PositionEstimate {
  position: Point2D;
  /** 0–1; higher means the distances agree more tightly on this point. */
  confidence: number;
  method: PositionMethod;
}

/**
 * Convert a BLE RSSI (dBm) to a distance in meters via the log-distance path-loss model.
 * `refRssi` is the RSSI at 1 m (a per-radio constant, typically ~-59 dBm) and `pathLoss` is the
 * environment exponent (2 in free space, 2.5–4 through walls).
 */
export function rssiToDistanceM(rssi: number, refRssi = -59, pathLoss = 2): number {
  return 10 ** ((refRssi - rssi) / (10 * pathLoss));
}

function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** Mean absolute error between an estimate's implied distances and the measured ones. */
function residual(point: Point2D, anchors: Anchor[], readings: DistanceReading[]): number {
  const byId = new Map(anchors.map((anchor) => [anchor.id, anchor]));
  let total = 0;
  let count = 0;
  for (const reading of readings) {
    const anchor = byId.get(reading.anchorId);
    if (!anchor) continue;
    total += Math.abs(distance(point, anchor.position) - reading.distanceM);
    count += 1;
  }
  return count === 0 ? Infinity : total / count;
}

/**
 * Least-squares trilateration. Subtracts a reference equation to linearize the circle equations,
 * then solves the 2×2 normal equations. Returns null when there are fewer than three anchors or
 * they're collinear/degenerate (a singular system) — the caller falls back to proximity.
 */
export function trilaterate(anchors: Anchor[], readings: DistanceReading[]): Point2D | null {
  const byId = new Map(anchors.map((anchor) => [anchor.id, anchor]));
  const points: Array<{ p: Point2D; d: number }> = [];
  for (const reading of readings) {
    const anchor = byId.get(reading.anchorId);
    if (anchor) points.push({ p: anchor.position, d: reading.distanceM });
  }
  if (points.length < 3) return null;

  const ref = points[0];
  let a11 = 0;
  let a12 = 0;
  let a22 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 1; i < points.length; i += 1) {
    const { p, d } = points[i];
    const ax = 2 * (p.x - ref.p.x);
    const az = 2 * (p.z - ref.p.z);
    const bi = p.x ** 2 - ref.p.x ** 2 + (p.z ** 2 - ref.p.z ** 2) - (d ** 2 - ref.d ** 2);
    a11 += ax * ax;
    a12 += ax * az;
    a22 += az * az;
    b1 += ax * bi;
    b2 += az * bi;
  }

  const det = a11 * a22 - a12 * a12;
  if (Math.abs(det) < 1e-9) return null;
  return {
    x: (a22 * b1 - a12 * b2) / det,
    z: (a11 * b2 - a12 * b1) / det,
  };
}

/** Distance-weighted blend of anchor positions — closer anchors pull harder. */
function proximity(anchors: Anchor[], readings: DistanceReading[]): Point2D | null {
  const byId = new Map(anchors.map((anchor) => [anchor.id, anchor]));
  let x = 0;
  let z = 0;
  let weightSum = 0;
  for (const reading of readings) {
    const anchor = byId.get(reading.anchorId);
    if (!anchor) continue;
    const weight = 1 / Math.max(0.1, reading.distanceM);
    x += anchor.position.x * weight;
    z += anchor.position.z * weight;
    weightSum += weight;
  }
  if (weightSum === 0) return null;
  return { x: x / weightSum, z: z / weightSum };
}

/**
 * Estimate a device's position from its distance readings. Prefers trilateration (≥3 anchors) and
 * falls back to a proximity blend (1–2 anchors); returns null when nothing usable is available.
 * Confidence shrinks as the residual grows, and the proximity fallback is capped lower since a
 * blend of one or two anchors can't pin a point.
 */
export function estimatePosition(
  anchors: Anchor[],
  readings: DistanceReading[],
): PositionEstimate | null {
  const known = readings.filter((reading) => anchors.some((a) => a.id === reading.anchorId));
  if (known.length === 0) return null;

  const trilaterated = trilaterate(anchors, known);
  if (trilaterated) {
    const error = residual(trilaterated, anchors, known);
    return {
      position: trilaterated,
      confidence: Math.max(0, Math.min(1, 1 / (1 + error))),
      method: 'trilateration',
    };
  }

  const blended = proximity(anchors, known);
  if (!blended) return null;
  const error = residual(blended, anchors, known);
  return {
    position: blended,
    confidence: Math.min(0.5, 1 / (1 + error)),
    method: 'proximity',
  };
}

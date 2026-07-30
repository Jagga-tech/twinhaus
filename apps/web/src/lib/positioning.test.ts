import { describe, expect, it } from 'vitest';
import {
  estimatePosition,
  rssiToDistanceM,
  smoothPositions,
  trilaterate,
  type Anchor,
  type PositionEstimate,
} from './positioning.js';

const anchors: Anchor[] = [
  { id: 'a', position: { x: 0, z: 0 } },
  { id: 'b', position: { x: 6, z: 0 } },
  { id: 'c', position: { x: 0, z: 6 } },
];

/** Exact distances from each anchor to a chosen truth point. */
function readingsTo(x: number, z: number) {
  return anchors.map((anchor) => ({
    anchorId: anchor.id,
    distanceM: Math.hypot(anchor.position.x - x, anchor.position.z - z),
  }));
}

describe('rssiToDistanceM', () => {
  it('returns 1m at the reference RSSI and grows as signal weakens', () => {
    expect(rssiToDistanceM(-59, -59, 2)).toBeCloseTo(1, 5);
    expect(rssiToDistanceM(-79, -59, 2)).toBeCloseTo(10, 5);
    expect(rssiToDistanceM(-39, -59, 2)).toBeCloseTo(0.1, 5);
  });
});

describe('trilaterate', () => {
  it('recovers a point from exact distances', () => {
    const point = trilaterate(anchors, readingsTo(2, 3));
    expect(point).not.toBeNull();
    expect(point!.x).toBeCloseTo(2, 4);
    expect(point!.z).toBeCloseTo(3, 4);
  });

  it('returns null with fewer than three anchors', () => {
    expect(trilaterate(anchors, readingsTo(2, 3).slice(0, 2))).toBeNull();
  });

  it('returns null for collinear (degenerate) anchors', () => {
    const collinear: Anchor[] = [
      { id: 'a', position: { x: 0, z: 0 } },
      { id: 'b', position: { x: 2, z: 0 } },
      { id: 'c', position: { x: 4, z: 0 } },
    ];
    const readings = collinear.map((a) => ({
      anchorId: a.id,
      distanceM: Math.hypot(a.position.x - 1, a.position.z - 1),
    }));
    expect(trilaterate(collinear, readings)).toBeNull();
  });
});

describe('estimatePosition', () => {
  it('trilaterates with high confidence when distances agree', () => {
    const estimate = estimatePosition(anchors, readingsTo(2, 3));
    expect(estimate?.method).toBe('trilateration');
    expect(estimate!.position.x).toBeCloseTo(2, 3);
    expect(estimate!.confidence).toBeGreaterThan(0.9);
  });

  it('lowers confidence when readings are noisy and disagree', () => {
    const noisy = readingsTo(2, 3).map((r, i) => ({
      ...r,
      distanceM: r.distanceM + (i === 0 ? 2 : 0),
    }));
    const estimate = estimatePosition(anchors, noisy);
    expect(estimate?.method).toBe('trilateration');
    expect(estimate!.confidence).toBeLessThan(0.9);
  });

  it('falls back to proximity (capped confidence) with one or two anchors', () => {
    const estimate = estimatePosition(anchors, readingsTo(2, 3).slice(0, 2));
    expect(estimate?.method).toBe('proximity');
    expect(estimate!.confidence).toBeLessThanOrEqual(0.5);
  });

  it('returns null when no readings match a known anchor', () => {
    expect(estimatePosition(anchors, [{ anchorId: 'unknown', distanceM: 3 }])).toBeNull();
    expect(estimatePosition(anchors, [])).toBeNull();
  });
});

describe('smoothPositions', () => {
  const est = (x: number, z: number, confidence = 1): PositionEstimate => ({
    position: { x, z },
    confidence,
    method: 'trilateration',
  });

  it('eases a moved dot part-way toward the new reading', () => {
    const out = smoothPositions({ phone: est(0, 0) }, { phone: est(10, 0) }, 0.4);
    expect(out.phone.position.x).toBeCloseTo(4, 5);
  });

  it('adopts a newly-tracked device immediately', () => {
    const out = smoothPositions({}, { phone: est(3, 4) }, 0.4);
    expect(out.phone.position).toEqual({ x: 3, z: 4 });
  });

  it('drops devices that stopped reporting', () => {
    const out = smoothPositions({ phone: est(0, 0), watch: est(1, 1) }, { phone: est(0, 0) });
    expect(out.watch).toBeUndefined();
    expect(out.phone).toBeDefined();
  });
});

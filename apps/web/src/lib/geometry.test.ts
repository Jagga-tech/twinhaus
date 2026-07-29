import { describe, expect, it } from 'vitest';
import { boundsOf, pointInPolygon, polygonCentroid, roomAt, wallSegments } from './geometry.js';
import type { Room } from '../store/types.js';

const square = [
  { x: 0, z: 0 },
  { x: 4, z: 0 },
  { x: 4, z: 4 },
  { x: 0, z: 4 },
];

describe('geometry', () => {
  it('centroid of a square is its center', () => {
    const c = polygonCentroid(square);
    expect(c.x).toBeCloseTo(2);
    expect(c.z).toBeCloseTo(2);
  });

  it('bounds cover the extent', () => {
    const { min, max } = boundsOf(square);
    expect(min).toEqual({ x: 0, z: 0 });
    expect(max).toEqual({ x: 4, z: 4 });
  });

  it('point-in-polygon detects inside vs outside', () => {
    expect(pointInPolygon({ x: 2, z: 2 }, square)).toBe(true);
    expect(pointInPolygon({ x: 5, z: 5 }, square)).toBe(false);
  });

  it('roomAt finds the containing room', () => {
    const rooms: Room[] = [
      { id: 'a', name: 'A', polygon: square, height: 2.6 },
      { id: 'b', name: 'B', polygon: square.map((p) => ({ x: p.x + 10, z: p.z })), height: 2.6 },
    ];
    expect(roomAt({ x: 2, z: 2 }, rooms)?.id).toBe('a');
    expect(roomAt({ x: 12, z: 2 }, rooms)?.id).toBe('b');
    expect(roomAt({ x: 100, z: 100 }, rooms)).toBeUndefined();
  });

  it('wall segments: one per edge, length matches', () => {
    const walls = wallSegments({ id: 'a', name: 'A', polygon: square, height: 2.6 });
    expect(walls).toHaveLength(4);
    expect(walls[0].length).toBeCloseTo(4);
    expect(walls[0].center[1]).toBeCloseTo(1.3); // half height
  });
});

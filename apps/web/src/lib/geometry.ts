import type { Point2D, Room } from '../store/types.js';

/** Area-weighted centroid of a polygon. Falls back to the vertex average for degenerate input. */
export function polygonCentroid(points: Point2D[]): Point2D {
  if (points.length === 0) return { x: 0, z: 0 };
  let area = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const cross = a.x * b.z - b.x * a.z;
    area += cross;
    cx += (a.x + b.x) * cross;
    cz += (a.z + b.z) * cross;
  }
  if (Math.abs(area) < 1e-6) {
    const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, z: acc.z + p.z }), { x: 0, z: 0 });
    return { x: sum.x / points.length, z: sum.z / points.length };
  }
  area *= 0.5;
  return { x: cx / (6 * area), z: cz / (6 * area) };
}

/** Axis-aligned bounds of a set of points. */
export function boundsOf(points: Point2D[]): { min: Point2D; max: Point2D } {
  const min = { x: Infinity, z: Infinity };
  const max = { x: -Infinity, z: -Infinity };
  for (const p of points) {
    min.x = Math.min(min.x, p.x);
    min.z = Math.min(min.z, p.z);
    max.x = Math.max(max.x, p.x);
    max.z = Math.max(max.z, p.z);
  }
  return { min, max };
}

/** True if a point lies inside a polygon (ray casting). */
export function pointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects =
      a.z > point.z !== b.z > point.z &&
      point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Find the room whose polygon contains a point, if any. */
export function roomAt(point: Point2D, rooms: Room[]): Room | undefined {
  return rooms.find((room) => pointInPolygon(point, room.polygon));
}

export interface WallSegment {
  /** Midpoint of the wall, at half its height. */
  center: [number, number, number];
  /** Rotation around the Y axis to align the wall with its edge. */
  rotationY: number;
  /** Length of the edge, in meters. */
  length: number;
}

/** Build the wall segments for a room polygon so each edge can render as a thin box. */
export function wallSegments(room: Room): WallSegment[] {
  const segments: WallSegment[] = [];
  const { polygon, height } = room;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const length = Math.hypot(dx, dz);
    if (length < 1e-4) continue;
    segments.push({
      center: [(a.x + b.x) / 2, height / 2, (a.z + b.z) / 2],
      rotationY: -Math.atan2(dz, dx),
      length,
    });
  }
  return segments;
}

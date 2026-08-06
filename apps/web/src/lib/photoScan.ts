import type { DeviceCategory, Point2D, Room, TwinModel, VirtualDevice } from '../store/types.js';

/**
 * Turn a phone photo of a home into twin geometry. A vision model looks at the picture and
 * describes what it sees, the rooms and their rough size, and any smart devices or sensors on the
 * walls and surfaces. This module is the pure half: it parses that description and lays it out as
 * rooms and placed devices. The actual call to the vision model lives in `visionScan.ts`, so all
 * the shape-making here stays deterministic and testable.
 */

/** A room the vision model saw, with its estimated footprint in meters. */
export interface PhotoRoom {
  name: string;
  widthM: number;
  depthM: number;
  heightM?: number;
}

/** A smart device or sensor the vision model spotted in the photo. */
export interface PhotoDevice {
  category: DeviceCategory;
  label: string;
  /** The name of the room it is in, to match a {@link PhotoRoom}; the first room if unmatched. */
  room?: string;
}

/** The structured reading of a photo: what rooms and devices are in it. */
export interface PhotoScanResult {
  rooms: PhotoRoom[];
  devices: PhotoDevice[];
  /** A short free-text note from the model, e.g. what it was unsure about. */
  note?: string;
}

const CATEGORIES: DeviceCategory[] = [
  'light',
  'switch',
  'lock',
  'climate',
  'sensor',
  'motion',
  'camera',
  'media',
  'cover',
  'fan',
  'vacuum',
  'other',
];

/** Default coverage per category, matching the simulation catalog so photo devices look right. */
const COVERAGE: Record<DeviceCategory, { rangeM: number; fovDeg: number }> = {
  camera: { rangeM: 6, fovDeg: 90 },
  motion: { rangeM: 5, fovDeg: 360 },
  sensor: { rangeM: 4, fovDeg: 360 },
  light: { rangeM: 0, fovDeg: 0 },
  switch: { rangeM: 0, fovDeg: 0 },
  lock: { rangeM: 0, fovDeg: 0 },
  climate: { rangeM: 0, fovDeg: 0 },
  media: { rangeM: 0, fovDeg: 0 },
  cover: { rangeM: 0, fovDeg: 0 },
  fan: { rangeM: 0, fovDeg: 0 },
  vacuum: { rangeM: 0, fovDeg: 0 },
  other: { rangeM: 0, fovDeg: 0 },
};

const MIN_EDGE_M = 1.5;
const MAX_EDGE_M = 20;
const DEFAULT_HEIGHT_M = 2.6;
/** Gap between rooms when they are laid out in a row, so walls do not touch. */
const ROOM_GAP_M = 0.6;

/**
 * Parse the vision model's answer into a clean {@link PhotoScanResult}. The model is asked for JSON
 * but may wrap it in prose or a code fence, so we pull out the outermost object, then clamp room
 * sizes to sane bounds and coerce every device to a known category. Throws if no room is found.
 */
export function parsePhotoScan(raw: string): PhotoScanResult {
  const json = extractJson(raw);
  const data = JSON.parse(json) as {
    rooms?: unknown;
    devices?: unknown;
    note?: unknown;
  };

  const rooms = Array.isArray(data.rooms) ? data.rooms.map(toRoom).filter(isRoom) : [];
  if (rooms.length === 0) {
    throw new Error('The photo did not show a room the model could size up. Try a wider shot.');
  }
  const devices = Array.isArray(data.devices) ? data.devices.map(toDevice).filter(isDevice) : [];

  return {
    rooms,
    devices,
    note: typeof data.note === 'string' && data.note.trim() ? data.note.trim() : undefined,
  };
}

/**
 * Lay a parsed reading out as an importable twin: rooms become rectangles in a row, and each device
 * is dropped into the middle of its room (spread out when a room has several). `seed` keeps ids
 * unique across repeated scans so you can build a home room by room.
 */
export function photoScanToTwin(result: PhotoScanResult, seed = ''): TwinModel {
  const prefix = seed ? `photo${seed}_` : 'photo_';
  const rooms: Room[] = [];
  const centers = new Map<number, Point2D>();

  let cursorX = 0;
  result.rooms.forEach((room, index) => {
    const width = clamp(room.widthM, MIN_EDGE_M, MAX_EDGE_M);
    const depth = clamp(room.depthM, MIN_EDGE_M, MAX_EDGE_M);
    const x0 = cursorX;
    rooms.push({
      id: `${prefix}r${index}`,
      name: room.name,
      polygon: rectangle(x0, 0, width, depth),
      height: clamp(room.heightM ?? DEFAULT_HEIGHT_M, 2, 4),
    });
    centers.set(index, { x: x0 + width / 2, z: depth / 2 });
    cursorX += width + ROOM_GAP_M;
  });

  const virtualDevices: VirtualDevice[] = [];
  const perRoomCount = new Map<number, number>();
  result.devices.forEach((device, index) => {
    const roomIndex = matchRoom(device.room, result.rooms);
    const center = centers.get(roomIndex) ?? { x: 0, z: 0 };
    const seen = perRoomCount.get(roomIndex) ?? 0;
    perRoomCount.set(roomIndex, seen + 1);
    const coverage = COVERAGE[device.category];
    virtualDevices.push({
      id: `${prefix}d${index}`,
      category: device.category,
      label: device.label,
      roomId: rooms[roomIndex].id,
      // Spread multiple devices in a room along X so they do not stack on one spot.
      position: { x: center.x + (seen - 1) * 0.8, z: center.z },
      rotationY: 0,
      rangeM: coverage.rangeM,
      fovDeg: coverage.fovDeg,
    });
  });

  return { version: 1, rooms, devices: [], virtualDevices };
}

function toRoom(value: unknown): PhotoRoom | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Room';
  const widthM = Number(raw.widthM ?? raw.width);
  const depthM = Number(raw.depthM ?? raw.depth);
  if (!Number.isFinite(widthM) || !Number.isFinite(depthM)) return null;
  const heightM = Number(raw.heightM ?? raw.height);
  return { name, widthM, depthM, heightM: Number.isFinite(heightM) ? heightM : undefined };
}

function toDevice(value: unknown): PhotoDevice | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const label = typeof raw.label === 'string' && raw.label.trim() ? raw.label.trim() : '';
  if (!label) return null;
  const category = coerceCategory(raw.category);
  const room = typeof raw.room === 'string' && raw.room.trim() ? raw.room.trim() : undefined;
  return { category, label, room };
}

function isRoom(room: PhotoRoom | null): room is PhotoRoom {
  return room !== null;
}

function isDevice(device: PhotoDevice | null): device is PhotoDevice {
  return device !== null;
}

/** Snap whatever the model called a category to one we know, defaulting to `other`. */
function coerceCategory(value: unknown): DeviceCategory {
  const text = String(value ?? '').toLowerCase();
  const exact = CATEGORIES.find((category) => category === text);
  if (exact) return exact;
  // Accept common near-misses the model tends to produce.
  if (text.includes('therm') || text.includes('heat') || text.includes('hvac')) return 'climate';
  if (text.includes('bulb') || text.includes('lamp')) return 'light';
  if (text.includes('plug') || text.includes('outlet') || text.includes('socket')) return 'switch';
  if (text.includes('door') && text.includes('lock')) return 'lock';
  if (text.includes('cam') || text.includes('doorbell')) return 'camera';
  if (text.includes('motion') || text.includes('presence') || text.includes('pir')) return 'motion';
  if (text.includes('speaker') || text.includes('tv') || text.includes('display')) return 'media';
  if (text.includes('blind') || text.includes('shade') || text.includes('curtain')) return 'cover';
  if (text.includes('fan')) return 'fan';
  if (text.includes('sensor')) return 'sensor';
  return 'other';
}

/** Find the room a device names, case-insensitively; fall back to the first room. */
function matchRoom(name: string | undefined, rooms: PhotoRoom[]): number {
  if (name) {
    const target = name.toLowerCase();
    const index = rooms.findIndex((room) => room.name.toLowerCase() === target);
    if (index >= 0) return index;
  }
  return 0;
}

/** Pull the outermost JSON object out of a model reply that may have prose or fences around it. */
function extractJson(raw: string): string {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new Error('The vision model did not return a readable answer. Try another photo.');
  }
  return raw.slice(start, end + 1);
}

function rectangle(x0: number, z0: number, width: number, depth: number): Point2D[] {
  return [
    { x: x0, z: z0 },
    { x: x0 + width, z: z0 },
    { x: x0 + width, z: z0 + depth },
    { x: x0, z: z0 + depth },
  ];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

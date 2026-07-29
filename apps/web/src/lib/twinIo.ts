import type { Point2D, Room, TwinModel } from '../store/types.js';

/** Serialize the twin document to a downloadable JSON file (templates, backups, MCP server). */
export function downloadTwin(model: TwinModel, filename = 'twin.json'): void {
  const blob = new Blob([JSON.stringify(model, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Parse and validate a twin document from uploaded text. Throws on malformed input. */
export function parseTwin(text: string): TwinModel {
  const data = JSON.parse(text) as Partial<TwinModel>;
  if (!Array.isArray(data.rooms)) throw new Error('Not a twin file: missing "rooms".');
  return {
    version: 1,
    rooms: data.rooms as Room[],
    devices: Array.isArray(data.devices) ? data.devices : [],
    virtualDevices: Array.isArray(data.virtualDevices) ? data.virtualDevices : [],
  };
}

/**
 * A minimal capture format for turning an iPhone RoomPlan / photogrammetry export into rooms.
 * The native scan produces one entry per detected room with a name and a floor polygon in
 * meters; this consumes that so the LiDAR pipeline lands as importable geometry.
 */
export interface RoomCapture {
  rooms: Array<{ name: string; polygon: Point2D[]; height?: number }>;
}

/** Convert a {@link RoomCapture} (RoomPlan-style export) into a {@link TwinModel}. */
export function captureToTwin(capture: RoomCapture): TwinModel {
  if (!Array.isArray(capture.rooms)) throw new Error('Capture has no "rooms" array.');
  return {
    version: 1,
    rooms: capture.rooms.map((room, index) => ({
      id: `cap_${index}`,
      name: room.name || `Room ${index + 1}`,
      polygon: room.polygon,
      height: room.height ?? 2.6,
    })),
    devices: [],
    virtualDevices: [],
  };
}

/** Read an uploaded File as text (for twin/capture JSON imports). */
export function readFileText(file: File): Promise<string> {
  return file.text();
}

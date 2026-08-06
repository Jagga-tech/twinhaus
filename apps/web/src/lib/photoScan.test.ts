import { describe, expect, it } from 'vitest';
import { parsePhotoScan, photoScanToTwin, type PhotoScanResult } from './photoScan.js';

describe('parsePhotoScan', () => {
  it('reads rooms and devices out of a fenced JSON reply', () => {
    const reply = [
      'Here is what I see:',
      '```json',
      JSON.stringify({
        rooms: [{ name: 'Living room', widthM: 4, depthM: 5, heightM: 2.7 }],
        devices: [
          { category: 'camera', label: 'Indoor camera', room: 'Living room' },
          { category: 'light', label: 'Ceiling light', room: 'Living room' },
        ],
        note: 'Estimated size from the door width.',
      }),
      '```',
    ].join('\n');
    const result = parsePhotoScan(reply);
    expect(result.rooms).toHaveLength(1);
    expect(result.rooms[0]).toMatchObject({ name: 'Living room', widthM: 4, depthM: 5 });
    expect(result.devices.map((d) => d.category)).toEqual(['camera', 'light']);
    expect(result.note).toContain('door width');
  });

  it('coerces unknown category words to a known category', () => {
    const result = parsePhotoScan(
      JSON.stringify({
        rooms: [{ name: 'Hall', widthM: 2, depthM: 3 }],
        devices: [
          { category: 'smart thermostat', label: 'Nest' },
          { category: 'video doorbell', label: 'Doorbell' },
          { category: 'smart plug', label: 'Plug' },
          { category: 'gizmo', label: 'Mystery' },
        ],
      }),
    );
    expect(result.devices.map((d) => d.category)).toEqual(['climate', 'camera', 'switch', 'other']);
  });

  it('drops devices with no label and rooms with no size', () => {
    const result = parsePhotoScan(
      JSON.stringify({
        rooms: [{ name: 'Kitchen', widthM: 3, depthM: 3 }, { name: 'No size' }],
        devices: [
          { category: 'light', label: '' },
          { category: 'light', label: 'Lamp' },
        ],
      }),
    );
    expect(result.rooms).toHaveLength(1);
    expect(result.devices).toHaveLength(1);
    expect(result.devices[0].label).toBe('Lamp');
  });

  it('throws when there is no room', () => {
    expect(() => parsePhotoScan(JSON.stringify({ rooms: [], devices: [] }))).toThrow();
  });

  it('throws when there is no JSON at all', () => {
    expect(() => parsePhotoScan('I could not read this photo.')).toThrow();
  });
});

describe('photoScanToTwin', () => {
  const result: PhotoScanResult = {
    rooms: [
      { name: 'Living room', widthM: 4, depthM: 5 },
      { name: 'Kitchen', widthM: 3, depthM: 3 },
    ],
    devices: [
      { category: 'camera', label: 'Cam', room: 'Kitchen' },
      { category: 'light', label: 'Light A', room: 'Living room' },
      { category: 'light', label: 'Light B', room: 'Living room' },
    ],
  };

  it('lays rooms out in a non-overlapping row', () => {
    const twin = photoScanToTwin(result);
    expect(twin.rooms).toHaveLength(2);
    const first = twin.rooms[0].polygon;
    const second = twin.rooms[1].polygon;
    const firstRight = Math.max(...first.map((p) => p.x));
    const secondLeft = Math.min(...second.map((p) => p.x));
    expect(secondLeft).toBeGreaterThan(firstRight);
  });

  it('drops each device into its named room and applies coverage defaults', () => {
    const twin = photoScanToTwin(result);
    expect(twin.virtualDevices).toHaveLength(3);
    const cam = twin.virtualDevices.find((d) => d.label === 'Cam');
    const kitchen = twin.rooms.find((r) => r.name === 'Kitchen');
    expect(cam?.roomId).toBe(kitchen?.id);
    expect(cam?.rangeM).toBe(6);
    expect(cam?.fovDeg).toBe(90);
  });

  it('spreads two devices in the same room to different spots', () => {
    const twin = photoScanToTwin(result);
    const a = twin.virtualDevices.find((d) => d.label === 'Light A');
    const b = twin.virtualDevices.find((d) => d.label === 'Light B');
    expect(a?.position.x).not.toBe(b?.position.x);
  });

  it('clamps absurd room sizes into a sane range', () => {
    const twin = photoScanToTwin({
      rooms: [{ name: 'Huge', widthM: 500, depthM: 0.1 }],
      devices: [],
    });
    const xs = twin.rooms[0].polygon.map((p) => p.x);
    const zs = twin.rooms[0].polygon.map((p) => p.z);
    expect(Math.max(...xs)).toBeLessThanOrEqual(20);
    expect(Math.max(...zs)).toBeGreaterThanOrEqual(1.5);
  });

  it('keeps ids unique across scans when a seed is given', () => {
    const first = photoScanToTwin(result, '0');
    const second = photoScanToTwin(result, '2');
    const ids = new Set([...first.rooms, ...second.rooms].map((r) => r.id));
    expect(ids.size).toBe(first.rooms.length + second.rooms.length);
  });
});

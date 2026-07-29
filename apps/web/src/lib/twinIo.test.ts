import { describe, expect, it } from 'vitest';
import { captureToTwin, parseTwin } from './twinIo.js';

describe('parseTwin', () => {
  it('parses a valid twin document', () => {
    const model = parseTwin(
      JSON.stringify({ rooms: [{ id: 'r1', name: 'A', polygon: [], height: 2.6 }] }),
    );
    expect(model.version).toBe(1);
    expect(model.rooms).toHaveLength(1);
    expect(model.devices).toEqual([]);
    expect(model.virtualDevices).toEqual([]);
  });

  it('throws on a document without rooms', () => {
    expect(() => parseTwin('{"foo":1}')).toThrow(/rooms/);
  });
});

describe('captureToTwin', () => {
  it('converts a RoomPlan-style capture into rooms with ids and default height', () => {
    const model = captureToTwin({
      rooms: [{ name: 'Bedroom', polygon: [{ x: 0, z: 0 }] }],
    });
    expect(model.rooms[0].id).toBe('cap_0');
    expect(model.rooms[0].name).toBe('Bedroom');
    expect(model.rooms[0].height).toBe(2.6);
  });

  it('names unnamed rooms and throws on a bad capture', () => {
    const model = captureToTwin({ rooms: [{ name: '', polygon: [] }] });
    expect(model.rooms[0].name).toBe('Room 1');
    // @ts-expect-error deliberately malformed input
    expect(() => captureToTwin({})).toThrow();
  });
});

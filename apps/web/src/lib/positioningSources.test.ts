import { describe, expect, it } from 'vitest';
import type { HaEntityState } from '@twinhaus/ha-bridge';
import type { DevicePlacement } from '../store/types.js';
import { deriveLivePositions, positioningStatus } from './positioningSources.js';

const devices: DevicePlacement[] = [
  { entityId: 'sensor.proxy_a', roomId: 'r', position: { x: 0, z: 0 } },
  { entityId: 'sensor.proxy_b', roomId: 'r', position: { x: 6, z: 0 } },
  { entityId: 'sensor.proxy_c', roomId: 'r', position: { x: 0, z: 6 } },
  { entityId: 'device_tracker.phone', roomId: 'r', position: { x: 3, z: 3 } },
];

function distanceSensor(id: string, anchor: string, target: string, meters: number): HaEntityState {
  return {
    entity_id: id,
    state: String(meters),
    attributes: { device_class: 'distance', anchor, target },
    last_changed: '',
    last_updated: '',
  } as HaEntityState;
}

function statesFrom(list: HaEntityState[]): Record<string, HaEntityState> {
  return Object.fromEntries(list.map((s) => [s.entity_id, s]));
}

describe('deriveLivePositions', () => {
  it('locates a target from anchored distance sensors', () => {
    const truth = { x: 2, z: 3 };
    const states = statesFrom([
      distanceSensor(
        'sensor.d_a',
        'sensor.proxy_a',
        'device_tracker.phone',
        Math.hypot(0 - 2, 0 - 3),
      ),
      distanceSensor(
        'sensor.d_b',
        'sensor.proxy_b',
        'device_tracker.phone',
        Math.hypot(6 - 2, 0 - 3),
      ),
      distanceSensor(
        'sensor.d_c',
        'sensor.proxy_c',
        'device_tracker.phone',
        Math.hypot(0 - 2, 6 - 3),
      ),
    ]);
    const positions = deriveLivePositions(devices, states);
    expect(positions['device_tracker.phone'].method).toBe('trilateration');
    expect(positions['device_tracker.phone'].position.x).toBeCloseTo(truth.x, 3);
    expect(positions['device_tracker.phone'].position.z).toBeCloseTo(truth.z, 3);
  });

  it('ignores non-distance sensors and unplaced anchors', () => {
    const states = statesFrom([
      {
        entity_id: 'sensor.temp',
        state: '21',
        attributes: { device_class: 'temperature' },
      } as HaEntityState,
      distanceSensor('sensor.d_x', 'sensor.not_placed', 'device_tracker.phone', 3),
    ]);
    expect(deriveLivePositions(devices, states)).toEqual({});
  });

  it('is inert with no distance sensors at all', () => {
    expect(deriveLivePositions(devices, {})).toEqual({});
  });
});

describe('positioningStatus', () => {
  it('is not ready with no distance sensors', () => {
    const status = positioningStatus(devices, {});
    expect(status.ready).toBe(false);
    expect(status.anchorsReferenced).toEqual([]);
  });

  it('is ready with three placed anchors and a tracked target', () => {
    const states = statesFrom([
      distanceSensor('sensor.d_a', 'sensor.proxy_a', 'device_tracker.phone', 1),
      distanceSensor('sensor.d_b', 'sensor.proxy_b', 'device_tracker.phone', 2),
      distanceSensor('sensor.d_c', 'sensor.proxy_c', 'device_tracker.phone', 3),
    ]);
    const status = positioningStatus(devices, states);
    expect(status.ready).toBe(true);
    expect(status.anchorsPlaced.sort()).toEqual([
      'sensor.proxy_a',
      'sensor.proxy_b',
      'sensor.proxy_c',
    ]);
    expect(status.anchorsMissing).toEqual([]);
    expect(status.targets).toEqual(['device_tracker.phone']);
  });

  it('flags anchors referenced but not yet placed', () => {
    const states = statesFrom([
      distanceSensor('sensor.d_a', 'sensor.proxy_a', 'device_tracker.phone', 1),
      distanceSensor('sensor.d_x', 'sensor.not_placed', 'device_tracker.phone', 2),
    ]);
    const status = positioningStatus(devices, states);
    expect(status.ready).toBe(false);
    expect(status.anchorsPlaced).toEqual(['sensor.proxy_a']);
    expect(status.anchorsMissing).toEqual(['sensor.not_placed']);
  });
});

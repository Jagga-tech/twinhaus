import { describe, expect, it } from 'vitest';
import type { HaEntityState } from '@twinhaus/ha-bridge';
import type { DevicePlacement } from '../store/types.js';
import { sceneFromStates, sceneToCalls, type Scene } from './scenes.js';

function st(id: string, state: string, attrs: HaEntityState['attributes'] = {}): HaEntityState {
  return { entity_id: id, state, attributes: attrs, last_changed: '', last_updated: '' };
}

const devices: DevicePlacement[] = [
  { entityId: 'light.lamp', roomId: 'r', position: { x: 0, z: 0 } },
  { entityId: 'switch.tv', roomId: 'r', position: { x: 1, z: 1 } },
  { entityId: 'sensor.temp', roomId: 'r', position: { x: 2, z: 2 } },
];

describe('sceneFromStates', () => {
  it('captures controllable devices and skips sensors', () => {
    const scene = sceneFromStates('Evening', devices, {
      'light.lamp': st('light.lamp', 'on', { brightness: 128 }),
      'switch.tv': st('switch.tv', 'off'),
      'sensor.temp': st('sensor.temp', '21'),
    });
    expect(scene.name).toBe('Evening');
    expect(scene.entries).toEqual([
      { entityId: 'light.lamp', service: 'turn_on', data: { brightness_pct: 50 } },
      { entityId: 'switch.tv', service: 'turn_off' },
    ]);
  });
});

describe('sceneToCalls', () => {
  it('reproduces a scene as service calls', () => {
    const scene: Scene = {
      id: 's1',
      name: 'Evening',
      entries: [{ entityId: 'light.lamp', service: 'turn_on', data: { brightness_pct: 50 } }],
    };
    expect(sceneToCalls(scene)).toEqual([
      {
        domain: 'light',
        service: 'turn_on',
        target: { entity_id: 'light.lamp' },
        serviceData: { brightness_pct: 50 },
      },
    ]);
  });
});

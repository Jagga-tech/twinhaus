import { describe, expect, it } from 'vitest';
import type { HaEntityState } from '@twinhaus/ha-bridge';
import type { DevicePlacement, Room } from '../store/types.js';
import { homeInsights } from './homeInsights.js';

const room: Room = { id: 'r', name: 'Home', polygon: [], height: 2.4 };

function st(
  entity_id: string,
  state: string,
  attributes: HaEntityState['attributes'] = {},
): HaEntityState {
  return { entity_id, state, attributes, last_changed: '', last_updated: '' };
}

function states(list: HaEntityState[]): Record<string, HaEntityState> {
  return Object.fromEntries(list.map((s) => [s.entity_id, s]));
}

const placed: DevicePlacement[] = [{ entityId: 'light.a', roomId: 'r', position: { x: 0, z: 0 } }];

describe('homeInsights', () => {
  it('flags an unlocked lock as a warning', () => {
    const out = homeInsights([room], placed, states([st('lock.front', 'unlocked')]));
    const lock = out.find((i) => i.id.startsWith('unlocked:'));
    expect(lock?.severity).toBe('warning');
    expect(lock?.entityId).toBe('lock.front');
  });

  it('flags climate running with a cover open', () => {
    const out = homeInsights(
      [room],
      placed,
      states([st('climate.hall', 'heat'), st('cover.window', 'open')]),
    );
    expect(out.some((i) => i.id === 'climate-open')).toBe(true);
  });

  it('flags many lights on and high power draw', () => {
    const lights = Array.from({ length: 5 }, (_, i) => st(`light.l${i}`, 'on'));
    const withPower: DevicePlacement[] = [
      ...placed,
      { entityId: 'sensor.p', roomId: 'r', position: { x: 1, z: 1 } },
    ];
    const out = homeInsights(
      [room],
      withPower,
      states([
        ...lights,
        st('sensor.p', '3500', { device_class: 'power', unit_of_measurement: 'W' }),
      ]),
    );
    expect(out.some((i) => i.id === 'many-lights')).toBe(true);
    expect(out.some((i) => i.id === 'high-power')).toBe(true);
  });

  it('reports all-clear when devices are placed but nothing stands out', () => {
    const out = homeInsights([room], placed, states([st('light.a', 'off')]));
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('all-clear');
  });

  it('says nothing when there is no live state at all', () => {
    expect(homeInsights([room], [], {})).toEqual([]);
  });
});

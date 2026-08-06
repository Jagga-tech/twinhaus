import { describe, expect, it } from 'vitest';
import type { HaEntityState } from '@twinhaus/ha-bridge';
import { centralBrain, isAway } from './brain.js';

function st(id: string, state: string, attrs: HaEntityState['attributes'] = {}): HaEntityState {
  return { entity_id: id, state, attributes: attrs, last_changed: '', last_updated: '' };
}

function states(list: HaEntityState[]): Record<string, HaEntityState> {
  return Object.fromEntries(list.map((s) => [s.entity_id, s]));
}

describe('isAway', () => {
  it('is away when trackers exist and none are home', () => {
    expect(isAway(states([st('person.a', 'not_home'), st('device_tracker.b', 'away')]))).toBe(true);
  });
  it('is not away when someone is home', () => {
    expect(isAway(states([st('person.a', 'home')]))).toBe(false);
  });
  it('is not away (unknown) when there are no trackers', () => {
    expect(isAway(states([st('light.x', 'on')]))).toBe(false);
  });
});

describe('centralBrain', () => {
  it('settles the house when away: lights off (auto), lock (auto), eco climate (auto)', () => {
    const decisions = centralBrain(
      states([
        st('person.sam', 'not_home'),
        st('light.a', 'on'),
        st('lock.front', 'unlocked'),
        st('climate.hall', 'heat', { temperature: 21 }),
      ]),
    );
    const ids = decisions.map((d) => d.id);
    expect(ids).toContain('away-lights');
    expect(ids).toContain('away-locks');
    expect(ids).toContain('away-climate');
    // Turning off lights, locking, and lowering a setpoint are all safe to run unattended.
    expect(decisions.every((d) => d.risk === 'auto')).toBe(true);
    const lights = decisions.find((d) => d.id === 'away-lights');
    expect(lights?.calls[0]).toEqual({
      domain: 'light',
      service: 'turn_off',
      target: { entity_id: 'light.a' },
    });
  });

  it('does nothing away-related when someone is home', () => {
    const decisions = centralBrain(states([st('person.sam', 'home'), st('light.a', 'on')]));
    expect(decisions.find((d) => d.id?.startsWith('away'))).toBeUndefined();
  });

  it('closes covers when climate runs with one open, regardless of presence', () => {
    const decisions = centralBrain(
      states([st('climate.hall', 'heat', { temperature: 21 }), st('cover.window', 'open')]),
    );
    const covers = decisions.find((d) => d.id === 'climate-open-covers');
    expect(covers?.risk).toBe('auto');
    expect(covers?.calls[0].service).toBe('close_cover');
  });

  it('returns nothing when the home is calm', () => {
    expect(centralBrain(states([st('person.sam', 'home'), st('light.a', 'off')]))).toEqual([]);
  });
});

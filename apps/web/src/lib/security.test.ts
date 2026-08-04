import { describe, expect, it } from 'vitest';
import type { HaEntityState } from '@twinhaus/ha-bridge';
import { securityReview } from './security.js';

function st(id: string, state: string, attrs: HaEntityState['attributes'] = {}): HaEntityState {
  return { entity_id: id, state, attributes: attrs, last_changed: '', last_updated: '' };
}

function states(list: HaEntityState[]): Record<string, HaEntityState> {
  return Object.fromEntries(list.map((s) => [s.entity_id, s]));
}

describe('securityReview', () => {
  it('reports secure when everything is buttoned up', () => {
    const review = securityReview(
      states([st('lock.front', 'locked'), st('cover.garage', 'closed')]),
    );
    expect(review.secure).toBe(true);
    expect(review.unlockedLocks).toEqual([]);
    expect(review.openEntries).toEqual([]);
  });

  it('flags unlocked locks, open covers, and open door sensors', () => {
    const review = securityReview(
      states([
        st('lock.front', 'unlocked'),
        st('cover.garage', 'open'),
        st('binary_sensor.back', 'on', { device_class: 'door' }),
        st('binary_sensor.motion', 'on', { device_class: 'motion' }),
      ]),
    );
    expect(review.secure).toBe(false);
    expect(review.unlockedLocks.map((i) => i.entityId)).toEqual(['lock.front']);
    expect(review.openEntries.map((i) => i.entityId).sort()).toEqual([
      'binary_sensor.back',
      'cover.garage',
    ]);
    // A motion sensor is not an entry point.
    expect(review.openEntries.some((i) => i.entityId === 'binary_sensor.motion')).toBe(false);
  });

  it('treats a disarmed alarm as not secure', () => {
    const review = securityReview(states([st('alarm_control_panel.house', 'disarmed')]));
    expect(review.alarm?.state).toBe('disarmed');
    expect(review.secure).toBe(false);
  });
});

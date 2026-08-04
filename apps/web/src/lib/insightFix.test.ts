import { describe, expect, it } from 'vitest';
import type { HaEntityState } from '@twinhaus/ha-bridge';
import { insightFix } from './insightFix.js';
import type { Insight } from './homeInsights.js';

function st(id: string, state: string): HaEntityState {
  return { entity_id: id, state, attributes: {}, last_changed: '', last_updated: '' };
}

describe('insightFix', () => {
  it('offers to lock an unlocked lock', () => {
    const insight: Insight = {
      id: 'unlocked:lock.front',
      severity: 'warning',
      message: 'Front is unlocked.',
      entityId: 'lock.front',
    };
    const fix = insightFix(insight, {});
    expect(fix?.label).toBe('Lock it');
    expect(fix?.calls[0]).toEqual({
      domain: 'lock',
      service: 'lock',
      target: { entity_id: 'lock.front' },
    });
  });

  it('offers to turn off all lights when many are on', () => {
    const insight: Insight = { id: 'many-lights', severity: 'attention', message: '5 lights on.' };
    const fix = insightFix(insight, {
      'light.a': st('light.a', 'on'),
      'light.b': st('light.b', 'on'),
      'light.c': st('light.c', 'off'),
    });
    expect(fix?.label).toBe('Turn them off');
    expect(fix?.calls).toHaveLength(2);
  });

  it('has no fix for high power draw', () => {
    const insight: Insight = { id: 'high-power', severity: 'attention', message: 'High draw.' };
    expect(insightFix(insight, {})).toBeNull();
  });
});

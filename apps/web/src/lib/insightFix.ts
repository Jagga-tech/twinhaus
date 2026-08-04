import { entityDomain, type CallServiceOptions, type HaEntityState } from '@twinhaus/ha-bridge';
import type { Insight } from './homeInsights.js';

/** A one-tap remedy the insight banner can offer for a noticed condition. */
export interface InsightFix {
  label: string;
  calls: CallServiceOptions[];
}

/**
 * Map an {@link Insight} to a concrete fix, so the proactive banner can offer a single button
 * ("Lock it", "Turn them off", "Close the covers"). Returns null when there is nothing to do
 * automatically (high power draw, an all-clear). Pure, so it is easy to test.
 */
export function insightFix(
  insight: Insight,
  entityStates: Record<string, HaEntityState>,
): InsightFix | null {
  if (insight.id.startsWith('unlocked:') && insight.entityId) {
    return {
      label: 'Lock it',
      calls: [{ domain: 'lock', service: 'lock', target: { entity_id: insight.entityId } }],
    };
  }

  if (insight.id === 'many-lights') {
    const lightsOn = Object.values(entityStates)
      .filter((s) => entityDomain(s.entity_id) === 'light' && s.state === 'on')
      .map((s) => s.entity_id);
    if (lightsOn.length === 0) return null;
    return {
      label: 'Turn them off',
      calls: lightsOn.map((entity_id) => ({
        domain: 'light',
        service: 'turn_off',
        target: { entity_id },
      })),
    };
  }

  if (insight.id === 'climate-open') {
    const openCovers = Object.values(entityStates)
      .filter((s) => entityDomain(s.entity_id) === 'cover' && s.state === 'open')
      .map((s) => s.entity_id);
    if (openCovers.length === 0) return null;
    return {
      label: 'Close the covers',
      calls: openCovers.map((entity_id) => ({
        domain: 'cover',
        service: 'close_cover',
        target: { entity_id },
      })),
    };
  }

  return null;
}

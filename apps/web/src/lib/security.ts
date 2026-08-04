import { entityDomain, type HaEntityState } from '@twinhaus/ha-bridge';
import { entityLabel } from './deviceState.js';

/** A single security observation about the home right now. */
export interface SecurityItem {
  entityId: string;
  label: string;
  kind: 'unlocked' | 'open' | 'disarmed';
}

export interface SecurityReview {
  unlockedLocks: SecurityItem[];
  openEntries: SecurityItem[];
  alarm: { entityId: string; label: string; state: string } | null;
  /** True when nothing needs attention: locks locked, entries closed, alarm not disarmed. */
  secure: boolean;
}

const ENTRY_CLASSES = new Set(['door', 'garage_door', 'window', 'opening']);

/**
 * A focused, pure security read of the home: which locks are unlocked, which doors/windows/covers
 * are open, and the alarm state. Drives a "is the house buttoned up?" summary and vacation checks,
 * separate from the broader homeInsights so it can be surfaced on its own.
 */
export function securityReview(entityStates: Record<string, HaEntityState>): SecurityReview {
  const unlockedLocks: SecurityItem[] = [];
  const openEntries: SecurityItem[] = [];
  let alarm: SecurityReview['alarm'] = null;

  for (const state of Object.values(entityStates)) {
    const domain = entityDomain(state.entity_id);
    const label = entityLabel(state.entity_id, state);

    if (domain === 'lock' && state.state === 'unlocked') {
      unlockedLocks.push({ entityId: state.entity_id, label, kind: 'unlocked' });
    } else if (domain === 'cover' && state.state === 'open') {
      openEntries.push({ entityId: state.entity_id, label, kind: 'open' });
    } else if (domain === 'binary_sensor' && state.state === 'on') {
      const deviceClass = String(state.attributes.device_class ?? '');
      if (ENTRY_CLASSES.has(deviceClass)) {
        openEntries.push({ entityId: state.entity_id, label, kind: 'open' });
      }
    } else if (domain === 'alarm_control_panel') {
      alarm = { entityId: state.entity_id, label, state: state.state };
    }
  }

  const secure =
    unlockedLocks.length === 0 &&
    openEntries.length === 0 &&
    (!alarm || alarm.state !== 'disarmed');

  return { unlockedLocks, openEntries, alarm, secure };
}

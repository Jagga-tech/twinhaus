import { entityDomain, type HaEntityState } from '@twinhaus/ha-bridge';
import type { DevicePlacement, Room } from '../store/types.js';
import { entityLabel } from './deviceState.js';
import { computeRoomEnergy } from './energy.js';

/** How much a noticed condition matters, so the UI and agent can rank and colour it. */
export type InsightSeverity = 'info' | 'attention' | 'warning';

/** Something worth telling the user about the home's current state. */
export interface Insight {
  id: string;
  severity: InsightSeverity;
  message: string;
  /** The entity the insight is about, if a single one, so the UI can select it in the twin. */
  entityId?: string;
}

/** Power draw (watts) above which the whole-home total is worth flagging. */
const HIGH_POWER_W = 3000;

/**
 * Notice conditions in the home the user probably wants to know about, security (a lock left
 * unlocked, an alarm disarmed), waste (heating with a cover open, many lights on in an empty
 * home), and load (unusually high power draw). Pure and conservative: it only reports what the
 * live state clearly shows, so the agent can be proactive without crying wolf.
 *
 * Ordered most-urgent first. Returns an empty array when nothing stands out.
 */
export function homeInsights(
  rooms: Room[],
  devices: DevicePlacement[],
  entityStates: Record<string, HaEntityState>,
): Insight[] {
  const insights: Insight[] = [];
  const placed = devices.map((device) => entityStates[device.entityId]).filter(isState);
  const all = Object.values(entityStates);

  // Security: locks left unlocked.
  for (const state of all) {
    if (entityDomain(state.entity_id) === 'lock' && state.state === 'unlocked') {
      insights.push({
        id: `unlocked:${state.entity_id}`,
        severity: 'warning',
        message: `${entityLabel(state.entity_id, state)} is unlocked.`,
        entityId: state.entity_id,
      });
    }
  }

  // Security: alarm disarmed (informational, common, so low severity).
  for (const state of all) {
    if (entityDomain(state.entity_id) === 'alarm_control_panel' && state.state === 'disarmed') {
      insights.push({
        id: `disarmed:${state.entity_id}`,
        severity: 'info',
        message: `${entityLabel(state.entity_id, state)} is disarmed.`,
        entityId: state.entity_id,
      });
    }
  }

  // Waste: heating or cooling while a cover/door is open.
  const heating = all.some(
    (s) =>
      entityDomain(s.entity_id) === 'climate' && ['heat', 'cool', 'heat_cool'].includes(s.state),
  );
  const openCovers = all.filter((s) => entityDomain(s.entity_id) === 'cover' && s.state === 'open');
  if (heating && openCovers.length > 0) {
    insights.push({
      id: 'climate-open',
      severity: 'attention',
      message: `Heating or cooling is running while ${openCovers.length} cover${
        openCovers.length === 1 ? ' is' : 's are'
      } open, ${openCovers.map((s) => entityLabel(s.entity_id, s)).join(', ')}.`,
      entityId: openCovers.length === 1 ? openCovers[0].entity_id : undefined,
    });
  }

  // Waste: a lot of lights left on.
  const lightsOn = all.filter((s) => entityDomain(s.entity_id) === 'light' && s.state === 'on');
  if (lightsOn.length >= 5) {
    insights.push({
      id: 'many-lights',
      severity: 'attention',
      message: `${lightsOn.length} lights are on.`,
    });
  }

  // Load: unusually high whole-home power draw.
  const energy = computeRoomEnergy(rooms, devices, entityStates);
  if (energy.total >= HIGH_POWER_W) {
    insights.push({
      id: 'high-power',
      severity: 'attention',
      message: `The home is drawing ${Math.round(energy.total)} W right now.`,
    });
  }

  // Nothing wrong, but say something useful if devices are placed and all is calm.
  if (insights.length === 0 && placed.length > 0) {
    insights.push({
      id: 'all-clear',
      severity: 'info',
      message: 'Nothing needs attention, locks secure, no climate waste, power looks normal.',
    });
  }

  return insights;
}

function isState(state: HaEntityState | undefined): state is HaEntityState {
  return state != null;
}

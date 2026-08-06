import { assessAction, toControlAction } from '@twinhaus/agent';
import { entityDomain, type CallServiceOptions, type HaEntityState } from '@twinhaus/ha-bridge';
import { entityLabel } from './deviceState.js';

/**
 * The central brain: one reasoning core that supervises the whole home at once. Because every
 * backend (Home Assistant, MQTT, Matter, Demo) lands in the same entity model, the brain sees them
 * all through one lens and coordinates across them, when you leave it settles the house down; when
 * it spots waste it fixes it.
 *
 * It is pure and deterministic so it is fully testable and never surprises. Each decision is
 * classified by the existing safety layer: `auto` decisions are safe to run unattended, `confirm`
 * decisions touch security or comfort and need a person to approve. The supervisor loop decides
 * whether to run, suggest, or ignore them based on the user's chosen mode.
 */
export type BrainMode = 'off' | 'suggest' | 'auto';
export type BrainRisk = 'auto' | 'confirm';

export interface BrainDecision {
  id: string;
  title: string;
  reason: string;
  risk: BrainRisk;
  calls: CallServiceOptions[];
}

/** Eco setpoint the brain drops climate to when the home is empty. */
const AWAY_SETPOINT_C = 16;

/** True when trackers exist and none are home, so the house is empty. Unknown when none exist. */
export function isAway(entityStates: Record<string, HaEntityState>): boolean {
  const trackers = Object.values(entityStates).filter((s) =>
    ['person', 'device_tracker'].includes(entityDomain(s.entity_id)),
  );
  if (trackers.length === 0) return false;
  return trackers.every((t) => t.state !== 'home');
}

/** Classify a bundle of calls: confirm if any single call is a guarded action, else auto. */
function riskOf(calls: CallServiceOptions[]): BrainRisk {
  for (const call of calls) {
    const action = toControlAction({
      domain: call.domain,
      service: call.service,
      entity_id: typeof call.target?.entity_id === 'string' ? call.target.entity_id : '',
      data: call.serviceData,
    });
    if (action && assessAction(action).requiresConfirmation) return 'confirm';
  }
  return 'auto';
}

function byDomain(states: HaEntityState[], domain: string): HaEntityState[] {
  return states.filter((s) => entityDomain(s.entity_id) === domain);
}

/**
 * Look at the whole home and decide what should happen. Returns actionable decisions only (each
 * carries the service calls that enact it), most impactful first.
 */
export function centralBrain(entityStates: Record<string, HaEntityState>): BrainDecision[] {
  const all = Object.values(entityStates);
  const decisions: BrainDecision[] = [];
  const away = isAway(entityStates);

  if (away) {
    const lightsOn = byDomain(all, 'light').filter((s) => s.state === 'on');
    if (lightsOn.length > 0) {
      const calls = lightsOn.map((s) => turnOff('light', s.entity_id));
      decisions.push({
        id: 'away-lights',
        title: `Turn off ${lightsOn.length} light${lightsOn.length === 1 ? '' : 's'}`,
        reason: 'No one is home.',
        risk: riskOf(calls),
        calls,
      });
    }

    const unlocked = byDomain(all, 'lock').filter((s) => s.state === 'unlocked');
    if (unlocked.length > 0) {
      const calls = unlocked.map((s) => ({
        domain: 'lock',
        service: 'lock',
        target: { entity_id: s.entity_id },
      }));
      decisions.push({
        id: 'away-locks',
        title: `Lock ${unlocked.map((s) => entityLabel(s.entity_id, s)).join(', ')}`,
        reason: 'No one is home and it is unlocked.',
        risk: riskOf(calls),
        calls,
      });
    }

    const warmClimate = byDomain(all, 'climate').filter(
      (s) =>
        ['heat', 'cool', 'heat_cool', 'auto'].includes(s.state) &&
        Number(s.attributes.temperature) > AWAY_SETPOINT_C,
    );
    if (warmClimate.length > 0) {
      const calls = warmClimate.map((s) => ({
        domain: 'climate',
        service: 'set_temperature',
        target: { entity_id: s.entity_id },
        serviceData: { temperature: AWAY_SETPOINT_C },
      }));
      decisions.push({
        id: 'away-climate',
        title: `Set climate to eco (${AWAY_SETPOINT_C} degrees)`,
        reason: 'No one is home, save energy.',
        risk: riskOf(calls),
        calls,
      });
    }
  }

  // Waste: heating or cooling while a cover is open, whether or not anyone is home.
  const heating = byDomain(all, 'climate').some((s) =>
    ['heat', 'cool', 'heat_cool'].includes(s.state),
  );
  const openCovers = byDomain(all, 'cover').filter((s) => s.state === 'open');
  if (heating && openCovers.length > 0) {
    const calls = openCovers.map((s) => ({
      domain: 'cover',
      service: 'close_cover',
      target: { entity_id: s.entity_id },
    }));
    decisions.push({
      id: 'climate-open-covers',
      title: `Close ${openCovers.length} open cover${openCovers.length === 1 ? '' : 's'}`,
      reason: 'Heating or cooling is running with a cover open.',
      risk: riskOf(calls),
      calls,
    });
  }

  return decisions;
}

function turnOff(domain: string, entityId: string): CallServiceOptions {
  return { domain, service: 'turn_off', target: { entity_id: entityId } };
}

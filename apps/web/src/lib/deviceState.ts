import { entityDomain, type HaEntityState } from '@twinhaus/ha-bridge';

/** Domains whose "active" visual should glow in the twin (lights, switches, motion). */
const ACTIVE_STATES = new Set(['on', 'open', 'unlocked', 'home', 'detected', 'playing']);

/** Whether an entity should render as "active" (e.g. a light that is on glows). */
export function isEntityActive(state: HaEntityState | undefined): boolean {
  if (!state) return false;
  return ACTIVE_STATES.has(state.state.toLowerCase());
}

/** A short human label for an entity, preferring its friendly name. */
export function entityLabel(entityId: string, state: HaEntityState | undefined): string {
  const friendly = state?.attributes.friendly_name;
  if (typeof friendly === 'string' && friendly.length > 0) return friendly;
  return entityId.split('.').slice(1).join('.').replace(/_/g, ' ') || entityId;
}

/** A compact one-line description of an entity's current value, for chat and tooltips. */
export function entitySummary(state: HaEntityState): string {
  const unit = state.attributes.unit_of_measurement;
  const value = unit ? `${state.state} ${unit}` : state.state;
  return `${entityLabel(state.entity_id, state)} (${state.entity_id}): ${value}`;
}

/** Domains that Phase 1 renders and lets the agent control. */
export function isSupportedDomain(entityId: string): boolean {
  return ['light', 'switch', 'lock', 'binary_sensor', 'sensor', 'climate', 'cover'].includes(
    entityDomain(entityId),
  );
}

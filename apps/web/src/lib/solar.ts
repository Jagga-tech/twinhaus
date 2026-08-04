import { entityDomain, type HaEntityState } from '@twinhaus/ha-bridge';
import { entityPowerWatts } from './energy.js';

/**
 * A best-effort read of the home's energy flow: solar production, grid draw, and battery. Home
 * setups vary wildly, so this matches on entity naming plus device_class rather than assuming one
 * integration's schema, and returns null when there is no solar or battery to show. Pure and
 * testable.
 */
export interface SolarSummary {
  solarW: number;
  gridW: number;
  batteryW: number;
  batteryPct: number | null;
  hasSolar: boolean;
  hasBattery: boolean;
}

function nameOf(state: HaEntityState): string {
  const friendly = state.attributes.friendly_name;
  return `${state.entity_id} ${typeof friendly === 'string' ? friendly : ''}`.toLowerCase();
}

export function solarSummary(entityStates: Record<string, HaEntityState>): SolarSummary | null {
  let solarW = 0;
  let gridW = 0;
  let batteryW = 0;
  let batteryPct: number | null = null;
  let hasSolar = false;
  let hasBattery = false;

  for (const state of Object.values(entityStates)) {
    const name = nameOf(state);
    const domain = entityDomain(state.entity_id);

    // Battery charge percentage.
    if (
      domain === 'sensor' &&
      state.attributes.device_class === 'battery' &&
      /battery|powerwall|storage/.test(name)
    ) {
      const pct = Number(state.state);
      if (Number.isFinite(pct)) {
        batteryPct = pct;
        hasBattery = true;
      }
      continue;
    }

    // Power flows, matched by name.
    const watts = entityPowerWatts(state);
    if (watts == null) continue;
    if (/solar|pv|inverter|production/.test(name)) {
      solarW += watts;
      hasSolar = true;
    } else if (/grid|mains|utility/.test(name)) {
      gridW += watts;
    } else if (/battery|powerwall|storage/.test(name)) {
      batteryW += watts;
      hasBattery = true;
    }
  }

  if (!hasSolar && !hasBattery) return null;
  return {
    solarW: Math.round(solarW),
    gridW: Math.round(gridW),
    batteryW: Math.round(batteryW),
    batteryPct,
    hasSolar,
    hasBattery,
  };
}

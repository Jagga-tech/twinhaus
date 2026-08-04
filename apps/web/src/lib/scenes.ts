import { entityDomain, type CallServiceOptions, type HaEntityState } from '@twinhaus/ha-bridge';
import type { DevicePlacement } from '../store/types.js';

/** One device's captured state within a scene, enough to reproduce it later. */
export interface SceneEntry {
  entityId: string;
  service: string;
  data?: Record<string, unknown>;
}

/** A named snapshot of how the controllable devices were set, so it can be re-applied. */
export interface Scene {
  id: string;
  name: string;
  entries: SceneEntry[];
}

const CONTROLLABLE = new Set(['light', 'switch', 'fan', 'climate', 'cover', 'media_player']);

/**
 * Capture the current state of the home's controllable devices into a reusable scene, the "save
 * what I have now" that powers learned scenes and one-tap moods. Pure: it reads placements and live
 * state and returns the entries; the store assigns the id and persists it.
 */
export function sceneFromStates(
  name: string,
  devices: DevicePlacement[],
  entityStates: Record<string, HaEntityState>,
): Omit<Scene, 'id'> {
  const entries: SceneEntry[] = [];
  for (const device of devices) {
    const state = entityStates[device.entityId];
    if (!state) continue;
    const entry = captureEntry(state);
    if (entry) entries.push(entry);
  }
  return { name, entries };
}

function captureEntry(state: HaEntityState): SceneEntry | null {
  const domain = entityDomain(state.entity_id);
  if (!CONTROLLABLE.has(domain)) return null;
  const entityId = state.entity_id;
  const on = state.state === 'on';

  switch (domain) {
    case 'light': {
      if (!on) return { entityId, service: 'turn_off' };
      const brightness = Number(state.attributes.brightness);
      const data = Number.isFinite(brightness)
        ? { brightness_pct: Math.round((brightness / 255) * 100) }
        : undefined;
      return { entityId, service: 'turn_on', data };
    }
    case 'switch':
    case 'fan':
      return { entityId, service: on ? 'turn_on' : 'turn_off' };
    case 'cover':
      return { entityId, service: state.state === 'open' ? 'open_cover' : 'close_cover' };
    case 'climate': {
      const temperature = Number(state.attributes.temperature);
      if (!Number.isFinite(temperature)) return null;
      return { entityId, service: 'set_temperature', data: { temperature } };
    }
    case 'media_player':
      return { entityId, service: state.state === 'playing' ? 'media_play' : 'media_pause' };
    default:
      return null;
  }
}

/** Turn a scene into the service calls that reproduce it. */
export function sceneToCalls(scene: Scene): CallServiceOptions[] {
  return scene.entries.map((entry) => ({
    domain: entityDomain(entry.entityId),
    service: entry.service,
    target: { entity_id: entry.entityId },
    serviceData: entry.data,
  }));
}

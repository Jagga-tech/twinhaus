import { entityDomain, type HaEntityState } from '@twinhaus/ha-bridge';

/** Domains whose "active" visual should glow in the twin (lights, switches, motion, …). */
const ACTIVE_STATES = new Set([
  'on',
  'open',
  'unlocked',
  'home',
  'detected',
  'playing',
  'cleaning',
  'returning',
  'heat',
  'cool',
  'heat_cool',
  'auto',
  'armed_home',
  'armed_away',
  'armed_night',
  'triggered',
]);

/** Whether an entity should render as "active" (e.g. a light that is on glows). */
export function isEntityActive(state: HaEntityState | undefined): boolean {
  if (!state) return false;
  return ACTIVE_STATES.has(state.state.toLowerCase());
}

/**
 * The live glow color and intensity a device should render with in the twin. Lights reflect
 * their real `rgb_color` and dim with `brightness`, so the 3D scene mirrors the room, warm
 * amber at 30%, the actual bulb color when set. Non-light actives fall back to a warm default.
 */
export function deviceGlow(state: HaEntityState | undefined): {
  color: string;
  intensity: number;
} {
  const fallback = '#ffca28';
  if (!isEntityActive(state) || !state) return { color: fallback, intensity: 0 };

  const rgb = state.attributes.rgb_color;
  const color =
    Array.isArray(rgb) && rgb.length === 3 ? rgbToHex(rgb[0], rgb[1], rgb[2]) : fallback;

  const brightness = Number(state.attributes.brightness);
  // Scale 0..255 brightness into a 0.35..1 glow so a dimmed light reads as dim, never invisible.
  const intensity = Number.isFinite(brightness) ? 0.35 + 0.65 * (brightness / 255) : 1;

  return { color, intensity: Math.max(0.35, Math.min(1, intensity)) };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return '#' + [r, g, b].map((n) => clamp(n).toString(16).padStart(2, '0')).join('');
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

/**
 * A tiny live-state badge for the device's label in the twin, "60%", "21°C", "playing",
 * "unlocked", so the 3D view reads at a glance without opening the inspector. Returns an empty
 * string when there's nothing worth showing.
 */
export function compactState(state: HaEntityState | undefined): string {
  if (!state) return '';
  const domain = entityDomain(state.entity_id);
  const attrs = state.attributes;

  switch (domain) {
    case 'light': {
      if (state.state !== 'on') return 'off';
      const brightness = Number(attrs.brightness);
      return Number.isFinite(brightness) ? `${Math.round((brightness / 255) * 100)}%` : 'on';
    }
    case 'fan': {
      if (state.state !== 'on') return 'off';
      const pct = Number(attrs.percentage);
      return Number.isFinite(pct) ? `${Math.round(pct)}%` : 'on';
    }
    case 'climate': {
      const temp = attrs.current_temperature ?? attrs.temperature;
      return temp != null ? `${temp}°` : state.state;
    }
    case 'sensor': {
      const unit = attrs.unit_of_measurement;
      return unit ? `${state.state}${unit}` : state.state;
    }
    default:
      return state.state;
  }
}

/** Domains the twin renders and lets you control from the inspector or the agent. */
export function isSupportedDomain(entityId: string): boolean {
  return [
    'light',
    'switch',
    'lock',
    'binary_sensor',
    'sensor',
    'climate',
    'cover',
    'fan',
    'media_player',
    'vacuum',
    'alarm_control_panel',
    'camera',
  ].includes(entityDomain(entityId));
}

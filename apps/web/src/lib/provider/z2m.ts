import type { CallServiceOptions, EntityState } from './types.js';

/**
 * Pure zigbee2mqtt mapping: the translation between z2m's MQTT topics/payloads and Twinhaus's
 * entity model, kept side-effect-free so it's fully testable without a broker. The MQTT provider
 * wires a transport around these functions.
 *
 * zigbee2mqtt is the most common Home-Assistant-free Zigbee stack: a broker plus the z2m bridge,
 * no HA required. It publishes each device's state to `zigbee2mqtt/<friendly_name>` and accepts
 * commands on `zigbee2mqtt/<friendly_name>/set`, and advertises the device list (retained) on
 * `zigbee2mqtt/bridge/devices`.
 */

export const Z2M_BASE = 'zigbee2mqtt';
export const Z2M_DEVICES_TOPIC = `${Z2M_BASE}/bridge/devices`;

/** A device z2m knows about, reduced to what Twinhaus needs to render and control it. */
export interface Z2mDevice {
  friendlyName: string;
  entityId: string;
  domain: string;
}

const DOMAIN_EXPOSE_TYPES = new Set(['light', 'switch', 'lock', 'cover', 'fan', 'climate']);

/** Slugify a friendly name into the entity-id suffix (`Living Room Lamp` → `living_room_lamp`). */
export function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Pick a Twinhaus domain from a z2m device's exposes; sensors are the catch-all. */
function domainFor(exposes: Array<{ type?: string }>): string {
  for (const expose of exposes) {
    if (expose.type && DOMAIN_EXPOSE_TYPES.has(expose.type)) return expose.type;
  }
  return 'sensor';
}

/** Parse a `bridge/devices` payload into the devices Twinhaus can place and control. */
export function parseDeviceList(payload: string): Z2mDevice[] {
  let raw: unknown;
  try {
    raw = JSON.parse(payload);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];

  const devices: Z2mDevice[] = [];
  for (const entry of raw) {
    const record = entry as {
      friendly_name?: string;
      type?: string;
      definition?: { exposes?: Array<{ type?: string }> } | null;
    };
    const friendlyName = record.friendly_name;
    // The coordinator itself has no friendly device role, skip it.
    if (!friendlyName || record.type === 'Coordinator') continue;
    const domain = domainFor(record.definition?.exposes ?? []);
    devices.push({ friendlyName, entityId: `${domain}.${slug(friendlyName)}`, domain });
  }
  return devices;
}

/** Convert a z2m state payload for one device into a Twinhaus {@link EntityState}. */
export function z2mToEntityState(device: Z2mDevice, payload: string): EntityState | null {
  let data: Record<string, unknown>;
  try {
    const parsed = JSON.parse(payload);
    if (!parsed || typeof parsed !== 'object') return null;
    data = parsed as Record<string, unknown>;
  } catch {
    return null;
  }

  const now = new Date().toISOString();
  const attributes: EntityState['attributes'] = { friendly_name: device.friendlyName, ...data };
  const state = deriveState(device.domain, data);
  return { entity_id: device.entityId, state, attributes, last_changed: now, last_updated: now };
}

function deriveState(domain: string, data: Record<string, unknown>): string {
  const raw = data.state;
  const onOff = typeof raw === 'string' ? raw.toUpperCase() : undefined;

  switch (domain) {
    case 'light':
    case 'switch':
    case 'fan':
      return onOff === 'ON' ? 'on' : 'off';
    case 'lock':
      return onOff === 'LOCK' || onOff === 'LOCKED' ? 'locked' : 'unlocked';
    case 'cover':
      if (typeof data.position === 'number') return data.position > 0 ? 'open' : 'closed';
      return onOff === 'OPEN' ? 'open' : 'closed';
    case 'sensor': {
      // Surface the most useful single reading as the state; the rest stay as attributes.
      for (const key of ['temperature', 'humidity', 'contact', 'occupancy', 'battery']) {
        if (key in data) return String(data[key]);
      }
      return typeof raw === 'string' ? raw : 'unknown';
    }
    default:
      return typeof raw === 'string' ? raw.toLowerCase() : 'unknown';
  }
}

/** A command to send: which topic to publish and the JSON payload to write. */
export interface Z2mCommand {
  topic: string;
  payload: string;
}

/** Translate a Twinhaus service call into a z2m `/set` publish for one device. */
export function serviceToZ2mSet(device: Z2mDevice, options: CallServiceOptions): Z2mCommand | null {
  const body = z2mSetBody(options);
  if (!body) return null;
  return {
    topic: `${Z2M_BASE}/${device.friendlyName}/set`,
    payload: JSON.stringify(body),
  };
}

function z2mSetBody(options: CallServiceOptions): Record<string, unknown> | null {
  const { service, serviceData } = options;
  switch (service) {
    case 'turn_on': {
      const body: Record<string, unknown> = { state: 'ON' };
      if (typeof serviceData?.brightness_pct === 'number') {
        body.brightness = Math.round((serviceData.brightness_pct / 100) * 254);
      }
      return body;
    }
    case 'turn_off':
      return { state: 'OFF' };
    case 'toggle':
      return { state: 'TOGGLE' };
    case 'lock':
      return { state: 'LOCK' };
    case 'unlock':
      return { state: 'UNLOCK' };
    case 'open_cover':
      return { state: 'OPEN' };
    case 'close_cover':
      return { state: 'CLOSE' };
    case 'stop_cover':
      return { state: 'STOP' };
    case 'set_percentage':
      return { state: Number(serviceData?.percentage ?? 0) > 0 ? 'ON' : 'OFF' };
    case 'set_temperature':
      if (typeof serviceData?.temperature === 'number') {
        return { current_heating_setpoint: serviceData.temperature };
      }
      return null;
    default:
      return null;
  }
}

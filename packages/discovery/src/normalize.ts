import type { RawConfigFlow } from '@twinhaus/ha-bridge';
import type { DeviceCategory, DiscoveredDevice, DiscoverySource } from './types.js';

/** Map Home Assistant's flow `context.source` onto our coarse {@link DiscoverySource}. */
function normalizeSource(source: string | undefined): DiscoverySource {
  switch (source) {
    case 'bluetooth':
      return 'bluetooth';
    case 'zeroconf':
    case 'homekit':
      return 'zeroconf';
    case 'ssdp':
      return 'ssdp';
    case 'dhcp':
      return 'dhcp';
    case 'usb':
      return 'usb';
    default:
      return 'other';
  }
}

interface BrandInfo {
  brand: string;
  category: DeviceCategory;
}

/**
 * Best-guess brand and category per integration handler. Discovered devices carry no entity id,
 * so category comes from the integration rather than the `deviceCategory` lib's entity mapping —
 * but the resulting values live in the same {@link DeviceCategory} space.
 */
const INTEGRATIONS: Record<string, BrandInfo> = {
  hue: { brand: 'Philips Hue', category: 'light' },
  lifx: { brand: 'LIFX', category: 'light' },
  wled: { brand: 'WLED', category: 'light' },
  nanoleaf: { brand: 'Nanoleaf', category: 'light' },
  tplink: { brand: 'TP-Link Kasa', category: 'switch' },
  shelly: { brand: 'Shelly', category: 'switch' },
  tasmota: { brand: 'Tasmota', category: 'switch' },
  august: { brand: 'August', category: 'lock' },
  nuki: { brand: 'Nuki', category: 'lock' },
  schlage: { brand: 'Schlage', category: 'lock' },
  nest: { brand: 'Google Nest', category: 'climate' },
  ecobee: { brand: 'ecobee', category: 'climate' },
  honeywell: { brand: 'Honeywell', category: 'climate' },
  ring: { brand: 'Ring', category: 'camera' },
  reolink: { brand: 'Reolink', category: 'camera' },
  unifiprotect: { brand: 'UniFi Protect', category: 'camera' },
  sonos: { brand: 'Sonos', category: 'media' },
  cast: { brand: 'Google Cast', category: 'media' },
  roku: { brand: 'Roku', category: 'media' },
  samsungtv: { brand: 'Samsung TV', category: 'media' },
  esphome: { brand: 'ESPHome', category: 'other' },
  motion_blinds: { brand: 'Motionblinds', category: 'cover' },
};

/** Category guess for an integration handler; falls back to `other`. */
export function guessCategory(handler: string): DeviceCategory {
  return INTEGRATIONS[handler]?.category ?? 'other';
}

function titleCase(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

/** Normalize a raw Home Assistant config flow into a {@link DiscoveredDevice}. */
export function normalizeFlow(flow: RawConfigFlow): DiscoveredDevice {
  const info = INTEGRATIONS[flow.handler];
  const placeholderName = flow.context?.title_placeholders?.name;
  return {
    id: flow.flow_id,
    name: placeholderName || info?.brand || titleCase(flow.handler),
    integration: flow.handler,
    brand: info?.brand ?? titleCase(flow.handler),
    source: normalizeSource(flow.context?.source),
    category: info?.category ?? 'other',
  };
}

/**
 * Normalize a batch of raw flows into discovered devices, keeping only those that came from a
 * discovery transport (a user-initiated flow has no `context.source`).
 */
export function normalizeFlows(flows: RawConfigFlow[]): DiscoveredDevice[] {
  return flows.filter((flow) => flow.context?.source).map(normalizeFlow);
}

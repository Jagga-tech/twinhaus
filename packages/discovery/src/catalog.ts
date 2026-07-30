import type { DeviceCategory } from './types.js';

/**
 * How a device talks to Home Assistant. A device can speak more than one, a Matter bulb also
 * rides Thread, a Shelly can be Wi-Fi today and add Zigbee tomorrow, so protocols is a set.
 */
export type Protocol =
  'wifi' | 'ethernet' | 'zigbee' | 'zwave' | 'thread' | 'matter' | 'bluetooth' | 'cloud';

/** Whether Home Assistant configures the device on the LAN or through the vendor's cloud account. */
export type Setup = 'local' | 'cloud';

/**
 * One buyable smart-home product Twinhaus can recommend. Twinhaus never sells or provisions these, * the `integration` handler is the Home Assistant integration that actually adds the device, so
 * every catalog entry links straight to HA's add flow rather than a store. This is the searchable
 * "what can I add?" layer that feeds the recommendation wizard and the agent.
 */
export interface CatalogDevice {
  id: string;
  brand: string;
  model: string;
  category: DeviceCategory;
  /** Home Assistant integration handler that configures this device (also keys its docs page). */
  integration: string;
  protocols: Protocol[];
  setup: Setup;
  approxPriceUsd: number;
  /** Suggested coverage range in meters for a simulated placement (0 for non-spatial devices). */
  rangeM: number;
  note?: string;
}

/** Filters narrowing a {@link searchCatalog} query; every field is optional and ANDed together. */
export interface CatalogFilter {
  category?: DeviceCategory;
  protocol?: Protocol;
  setup?: Setup;
  maxPriceUsd?: number;
}

/**
 * A curated cross-brand catalog of devices Home Assistant can add, spanning every
 * {@link DeviceCategory}, both local and cloud setups, and the common radios. It is intentionally
 * broad rather than exhaustive, enough to recommend a real product for any category and to let a
 * user search by brand, protocol, or budget. Handlers match `normalize.ts` so a device discovered
 * on the network can be cross-referenced back to its catalog entry.
 */
export const DEVICE_CATALOG: CatalogDevice[] = [
  {
    id: 'hue-white',
    brand: 'Philips Hue',
    model: 'White A19 bulb',
    category: 'light',
    integration: 'hue',
    protocols: ['zigbee'],
    setup: 'local',
    approxPriceUsd: 15,
    rangeM: 0,
    note: 'Needs a Hue bridge; rock-solid local control.',
  },
  {
    id: 'hue-color',
    brand: 'Philips Hue',
    model: 'White & Color A19',
    category: 'light',
    integration: 'hue',
    protocols: ['zigbee'],
    setup: 'local',
    approxPriceUsd: 50,
    rangeM: 0,
  },
  {
    id: 'lifx-color',
    brand: 'LIFX',
    model: 'Color A19',
    category: 'light',
    integration: 'lifx',
    protocols: ['wifi'],
    setup: 'local',
    approxPriceUsd: 45,
    rangeM: 0,
    note: 'No hub, bright, but a Wi-Fi client per bulb.',
  },
  {
    id: 'wled-strip',
    brand: 'WLED',
    model: 'Addressable LED strip',
    category: 'light',
    integration: 'wled',
    protocols: ['wifi'],
    setup: 'local',
    approxPriceUsd: 25,
    rangeM: 0,
    note: 'DIY; effects galore, fully local.',
  },
  {
    id: 'nanoleaf-shapes',
    brand: 'Nanoleaf',
    model: 'Shapes panels',
    category: 'light',
    integration: 'nanoleaf',
    protocols: ['wifi', 'thread'],
    setup: 'local',
    approxPriceUsd: 100,
    rangeM: 0,
  },
  {
    id: 'ikea-tradfri-bulb',
    brand: 'IKEA',
    model: 'TRÅDFRI bulb',
    category: 'light',
    integration: 'tradfri',
    protocols: ['zigbee'],
    setup: 'local',
    approxPriceUsd: 9,
    rangeM: 0,
    note: 'Cheapest way to start; pairs with any Zigbee hub.',
  },
  {
    id: 'tplink-kasa-plug',
    brand: 'TP-Link Kasa',
    model: 'HS103 smart plug',
    category: 'switch',
    integration: 'tplink',
    protocols: ['wifi'],
    setup: 'local',
    approxPriceUsd: 12,
    rangeM: 0,
  },
  {
    id: 'shelly-plus-1',
    brand: 'Shelly',
    model: 'Plus 1 relay',
    category: 'switch',
    integration: 'shelly',
    protocols: ['wifi'],
    setup: 'local',
    approxPriceUsd: 18,
    rangeM: 0,
    note: 'Fits behind an existing switch; local API.',
  },
  {
    id: 'shelly-plug-s',
    brand: 'Shelly',
    model: 'Plug S',
    category: 'switch',
    integration: 'shelly',
    protocols: ['wifi'],
    setup: 'local',
    approxPriceUsd: 15,
    rangeM: 0,
    note: 'Plug-in with power metering.',
  },
  {
    id: 'sonoff-mini',
    brand: 'Sonoff',
    model: 'MINIR4 (Tasmota)',
    category: 'switch',
    integration: 'tasmota',
    protocols: ['wifi'],
    setup: 'local',
    approxPriceUsd: 10,
    rangeM: 0,
    note: 'Flash Tasmota/ESPHome for cloud-free control.',
  },
  {
    id: 'august-wifi-lock',
    brand: 'August',
    model: 'Wi-Fi Smart Lock',
    category: 'lock',
    integration: 'august',
    protocols: ['wifi', 'bluetooth'],
    setup: 'cloud',
    approxPriceUsd: 130,
    rangeM: 0,
    note: 'Retrofits over your deadbolt; renter-friendly.',
  },
  {
    id: 'nuki-smart-lock',
    brand: 'Nuki',
    model: 'Smart Lock 4.0',
    category: 'lock',
    integration: 'nuki',
    protocols: ['wifi', 'bluetooth'],
    setup: 'local',
    approxPriceUsd: 160,
    rangeM: 0,
  },
  {
    id: 'schlage-encode',
    brand: 'Schlage',
    model: 'Encode deadbolt',
    category: 'lock',
    integration: 'schlage',
    protocols: ['wifi'],
    setup: 'cloud',
    approxPriceUsd: 200,
    rangeM: 0,
    note: 'Full deadbolt replacement with keypad.',
  },
  {
    id: 'yale-assure-zwave',
    brand: 'Yale',
    model: 'Assure Lock 2 (Z-Wave)',
    category: 'lock',
    integration: 'zwave_js',
    protocols: ['zwave'],
    setup: 'local',
    approxPriceUsd: 180,
    rangeM: 0,
    note: 'Local via a Z-Wave stick; no vendor cloud.',
  },
  {
    id: 'nest-thermostat',
    brand: 'Google Nest',
    model: 'Thermostat',
    category: 'climate',
    integration: 'nest',
    protocols: ['wifi', 'cloud'],
    setup: 'cloud',
    approxPriceUsd: 130,
    rangeM: 0,
    note: 'Requires a Google Device Access project.',
  },
  {
    id: 'ecobee-premium',
    brand: 'ecobee',
    model: 'Smart Thermostat Premium',
    category: 'climate',
    integration: 'ecobee',
    protocols: ['wifi', 'cloud'],
    setup: 'cloud',
    approxPriceUsd: 250,
    rangeM: 0,
  },
  {
    id: 'honeywell-t9',
    brand: 'Honeywell',
    model: 'T9 Smart Thermostat',
    category: 'climate',
    integration: 'honeywell',
    protocols: ['wifi', 'cloud'],
    setup: 'cloud',
    approxPriceUsd: 170,
    rangeM: 0,
  },
  {
    id: 'sonoff-trvzb',
    brand: 'Sonoff',
    model: 'TRVZB radiator valve',
    category: 'climate',
    integration: 'zha',
    protocols: ['zigbee'],
    setup: 'local',
    approxPriceUsd: 35,
    rangeM: 0,
    note: 'Per-radiator control for homes without central HVAC.',
  },
  {
    id: 'aqara-motion-p1',
    brand: 'Aqara',
    model: 'Motion Sensor P1',
    category: 'motion',
    integration: 'zha',
    protocols: ['zigbee'],
    setup: 'local',
    approxPriceUsd: 20,
    rangeM: 5,
    note: 'Battery Zigbee; ideal for older wiring.',
  },
  {
    id: 'hue-motion',
    brand: 'Philips Hue',
    model: 'Motion Sensor',
    category: 'motion',
    integration: 'hue',
    protocols: ['zigbee'],
    setup: 'local',
    approxPriceUsd: 40,
    rangeM: 6,
  },
  {
    id: 'aqara-contact',
    brand: 'Aqara',
    model: 'Door & Window Sensor',
    category: 'sensor',
    integration: 'zha',
    protocols: ['zigbee'],
    setup: 'local',
    approxPriceUsd: 15,
    rangeM: 0,
  },
  {
    id: 'aqara-temp',
    brand: 'Aqara',
    model: 'Temperature & Humidity Sensor',
    category: 'sensor',
    integration: 'zha',
    protocols: ['zigbee'],
    setup: 'local',
    approxPriceUsd: 15,
    rangeM: 0,
  },
  {
    id: 'emporia-vue',
    brand: 'Emporia',
    model: 'Vue energy monitor',
    category: 'sensor',
    integration: 'emporia_vue',
    protocols: ['wifi', 'cloud'],
    setup: 'cloud',
    approxPriceUsd: 150,
    rangeM: 0,
    note: 'Whole-panel energy; powers the per-room heatmap.',
  },
  {
    id: 'shelly-em',
    brand: 'Shelly',
    model: 'Pro 3EM',
    category: 'sensor',
    integration: 'shelly',
    protocols: ['wifi'],
    setup: 'local',
    approxPriceUsd: 120,
    rangeM: 0,
    note: 'Local three-phase energy metering.',
  },
  {
    id: 'ring-indoor-cam',
    brand: 'Ring',
    model: 'Indoor Cam',
    category: 'camera',
    integration: 'ring',
    protocols: ['wifi', 'cloud'],
    setup: 'cloud',
    approxPriceUsd: 40,
    rangeM: 6,
  },
  {
    id: 'reolink-e1',
    brand: 'Reolink',
    model: 'E1 Pro',
    category: 'camera',
    integration: 'reolink',
    protocols: ['wifi'],
    setup: 'local',
    approxPriceUsd: 50,
    rangeM: 7,
    note: 'Local RTSP; no subscription needed.',
  },
  {
    id: 'reolink-doorbell',
    brand: 'Reolink',
    model: 'Video Doorbell PoE',
    category: 'camera',
    integration: 'reolink',
    protocols: ['ethernet'],
    setup: 'local',
    approxPriceUsd: 100,
    rangeM: 8,
  },
  {
    id: 'unifi-g5-bullet',
    brand: 'Ubiquiti',
    model: 'UniFi Protect G5 Bullet',
    category: 'camera',
    integration: 'unifiprotect',
    protocols: ['ethernet'],
    setup: 'local',
    approxPriceUsd: 130,
    rangeM: 10,
    note: 'PoE; needs a UniFi Protect console.',
  },
  {
    id: 'sonos-one',
    brand: 'Sonos',
    model: 'One SL',
    category: 'media',
    integration: 'sonos',
    protocols: ['wifi'],
    setup: 'local',
    approxPriceUsd: 160,
    rangeM: 0,
  },
  {
    id: 'chromecast',
    brand: 'Google',
    model: 'Chromecast with Google TV',
    category: 'media',
    integration: 'cast',
    protocols: ['wifi'],
    setup: 'local',
    approxPriceUsd: 50,
    rangeM: 0,
  },
  {
    id: 'roku-express',
    brand: 'Roku',
    model: 'Express 4K',
    category: 'media',
    integration: 'roku',
    protocols: ['wifi'],
    setup: 'local',
    approxPriceUsd: 30,
    rangeM: 0,
  },
  {
    id: 'samsung-tv',
    brand: 'Samsung',
    model: 'Tizen Smart TV',
    category: 'media',
    integration: 'samsungtv',
    protocols: ['wifi'],
    setup: 'local',
    approxPriceUsd: 500,
    rangeM: 0,
  },
  {
    id: 'ikea-fyrtur',
    brand: 'IKEA',
    model: 'FYRTUR blackout blind',
    category: 'cover',
    integration: 'tradfri',
    protocols: ['zigbee'],
    setup: 'local',
    approxPriceUsd: 130,
    rangeM: 0,
  },
  {
    id: 'motionblinds-roller',
    brand: 'Motionblinds',
    model: 'Roller motor',
    category: 'cover',
    integration: 'motion_blinds',
    protocols: ['wifi'],
    setup: 'local',
    approxPriceUsd: 90,
    rangeM: 0,
  },
  {
    id: 'shelly-2pm-shade',
    brand: 'Shelly',
    model: 'Plus 2PM (roller mode)',
    category: 'cover',
    integration: 'shelly',
    protocols: ['wifi'],
    setup: 'local',
    approxPriceUsd: 25,
    rangeM: 0,
    note: 'Motorizes existing roller shutters locally.',
  },
  {
    id: 'esphome-diy',
    brand: 'ESPHome',
    model: 'ESP32 custom sensor',
    category: 'other',
    integration: 'esphome',
    protocols: ['wifi'],
    setup: 'local',
    approxPriceUsd: 8,
    rangeM: 0,
    note: 'Build any sensor; fully local, no cloud.',
  },
  {
    id: 'matter-plug',
    brand: 'Generic',
    model: 'Matter smart plug',
    category: 'switch',
    integration: 'matter',
    protocols: ['matter', 'thread'],
    setup: 'local',
    approxPriceUsd: 20,
    rangeM: 0,
    note: 'Cross-ecosystem; future-proof pairing.',
  },
];

const DOCS_BASE = 'https://www.home-assistant.io/integrations';

/** The Home Assistant documentation page describing how to add this device's integration. */
export function catalogDocsUrl(device: CatalogDevice): string {
  return `${DOCS_BASE}/${device.integration}`;
}

function matchesFilter(device: CatalogDevice, filter: CatalogFilter): boolean {
  if (filter.category && device.category !== filter.category) return false;
  if (filter.protocol && !device.protocols.includes(filter.protocol)) return false;
  if (filter.setup && device.setup !== filter.setup) return false;
  if (filter.maxPriceUsd !== undefined && device.approxPriceUsd > filter.maxPriceUsd) return false;
  return true;
}

function haystack(device: CatalogDevice): string {
  return [device.brand, device.model, device.category, device.integration, ...device.protocols]
    .join(' ')
    .toLowerCase();
}

/**
 * Search the catalog by free text plus optional filters. Query tokens are matched independently
 * (all must hit) against brand, model, category, integration, and protocols, so "local zigbee
 * light" narrows sensibly. Results are sorted cheapest-first to lead with approachable picks.
 */
export function searchCatalog(query = '', filter: CatalogFilter = {}): CatalogDevice[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return DEVICE_CATALOG.filter((device) => {
    if (!matchesFilter(device, filter)) return false;
    if (tokens.length === 0) return true;
    const hay = haystack(device);
    return tokens.every((token) => hay.includes(token));
  }).sort((a, b) => a.approxPriceUsd - b.approxPriceUsd);
}

/** The cheapest local-first catalog pick for a category, used to name a real product in the wizard. */
export function suggestForCategory(category: DeviceCategory): CatalogDevice | undefined {
  const matches = searchCatalog('', { category });
  return matches.find((device) => device.setup === 'local') ?? matches[0];
}

/** Every category that has at least one catalog entry, for building filter menus. */
export function catalogCategories(): DeviceCategory[] {
  return [...new Set(DEVICE_CATALOG.map((device) => device.category))];
}

/** Every protocol present in the catalog, for building filter menus. */
export function catalogProtocols(): Protocol[] {
  return [...new Set(DEVICE_CATALOG.flatMap((device) => device.protocols))];
}

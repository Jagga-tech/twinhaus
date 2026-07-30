import type { DeviceCategory, DiscoveredDevice } from '@twinhaus/discovery';

const CATEGORY_DOMAIN: Record<DeviceCategory, string> = {
  light: 'light',
  switch: 'switch',
  lock: 'lock',
  climate: 'climate',
  sensor: 'sensor',
  motion: 'binary_sensor',
  camera: 'camera',
  media: 'media_player',
  cover: 'cover',
  fan: 'fan',
  vacuum: 'vacuum',
  other: 'sensor',
};

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * A synthetic entity id for a just-added device, in the Home Assistant domain matching its
 * category. Until HA finishes setting up the entry and its real entities sync, this placeholder
 * lets the device render in the twin with the correct icon, placed the same way as any device.
 */
export function syntheticEntityId(device: DiscoveredDevice): string {
  const domain = CATEGORY_DOMAIN[device.category];
  const name = slug(device.name) || slug(device.integration) || 'device';
  return `${domain}.${name}`;
}

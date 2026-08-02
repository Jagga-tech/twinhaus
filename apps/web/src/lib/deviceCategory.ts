import { entityDomain, type HaEntityState } from '@twinhaus/ha-bridge';
import type { DeviceCategory } from '../store/types.js';

/**
 * Map a Home Assistant entity to a coarse {@link DeviceCategory}. Categories drive the twin's
 * device models, the coverage viz, and the recommendation wizard, one place to add a device
 * type and have it render, control, and recommend consistently.
 */
export function categorize(entityId: string, state?: HaEntityState): DeviceCategory {
  const domain = entityDomain(entityId);
  const deviceClass = String(state?.attributes.device_class ?? '');

  switch (domain) {
    case 'light':
      return 'light';
    case 'switch':
      return 'switch';
    case 'lock':
      return 'lock';
    case 'climate':
      return 'climate';
    case 'camera':
      return 'camera';
    case 'media_player':
      return 'media';
    case 'cover':
      return 'cover';
    case 'fan':
      return 'fan';
    case 'vacuum':
      return 'vacuum';
    case 'binary_sensor':
      return deviceClass === 'motion' || deviceClass === 'occupancy' ? 'motion' : 'sensor';
    case 'sensor':
      return 'sensor';
    default:
      return 'other';
  }
}

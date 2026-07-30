import type { DeviceCategory } from '../store/types.js';

export type Tier = 'starter' | 'mid' | 'full';
export type Ownership = 'rent' | 'own';

export interface RecommendedDevice {
  category: DeviceCategory;
  label: string;
  approxPriceUsd: number;
  /** Suggested coverage range in meters (drives the simulated placement's coverage viz). */
  rangeM: number;
  note?: string;
}

export interface TierPlan {
  id: Tier;
  name: string;
  blurb: string;
  devices: RecommendedDevice[];
}

/**
 * Device tiers for the retrofit funnel. A home with zero smart devices still gets a twin, then
 * this wizard recommends a tier and drops the devices in as simulated placements to preview
 * before buying, the "old home" wedge nobody else serves.
 */
export const TIERS: Record<Tier, TierPlan> = {
  starter: {
    id: 'starter',
    name: 'Starter',
    blurb: 'The essentials, smart lighting and presence, all plug-in or bulb-based.',
    devices: [
      {
        category: 'light',
        label: 'Smart bulb',
        approxPriceUsd: 15,
        rangeM: 0,
        note: 'One per key room',
      },
      { category: 'motion', label: 'Motion sensor', approxPriceUsd: 20, rangeM: 5 },
      { category: 'switch', label: 'Smart plug', approxPriceUsd: 12, rangeM: 0 },
    ],
  },
  mid: {
    id: 'mid',
    name: 'Mid',
    blurb: 'Comfort and security, adds a smart lock, thermostat, and a camera.',
    devices: [
      { category: 'light', label: 'Smart bulb', approxPriceUsd: 15, rangeM: 0 },
      { category: 'motion', label: 'Motion sensor', approxPriceUsd: 20, rangeM: 5 },
      { category: 'lock', label: 'Smart lock', approxPriceUsd: 130, rangeM: 0 },
      { category: 'climate', label: 'Smart thermostat', approxPriceUsd: 130, rangeM: 0 },
      { category: 'camera', label: 'Indoor camera', approxPriceUsd: 40, rangeM: 6 },
    ],
  },
  full: {
    id: 'full',
    name: 'Full',
    blurb: 'Whole-home, per-room sensing, cameras at entries, energy monitoring.',
    devices: [
      { category: 'light', label: 'Smart bulb', approxPriceUsd: 15, rangeM: 0 },
      { category: 'motion', label: 'Motion sensor', approxPriceUsd: 20, rangeM: 5 },
      { category: 'lock', label: 'Smart lock', approxPriceUsd: 130, rangeM: 0 },
      { category: 'climate', label: 'Smart thermostat', approxPriceUsd: 130, rangeM: 0 },
      { category: 'camera', label: 'Entry camera', approxPriceUsd: 60, rangeM: 8 },
      { category: 'cover', label: 'Motorized shade', approxPriceUsd: 90, rangeM: 0 },
      {
        category: 'sensor',
        label: 'Energy monitor',
        approxPriceUsd: 150,
        rangeM: 0,
        note: 'Whole-panel (Emporia/Shelly)',
      },
    ],
  },
};

export interface AuditInput {
  homeAgeYears: number;
  ownership: Ownership;
  budget: Tier;
}

export interface AuditResult {
  tier: TierPlan;
  notes: string[];
  estimatedCost: number;
}

/** Turn wizard answers into a recommended tier plus renter/owner and old-home caveats. */
export function recommend(input: AuditInput): AuditResult {
  const tier = TIERS[input.budget];
  const notes: string[] = [];

  if (input.ownership === 'rent') {
    notes.push(
      'Renter-friendly: favor plug-in and bulb devices; a smart lock may need landlord OK.',
    );
  }
  if (input.homeAgeYears >= 40) {
    notes.push(
      'Older wiring: prefer battery/Zigbee sensors over hardwired switches; check for a neutral wire before in-wall devices.',
    );
  }
  if (input.budget === 'full') {
    notes.push('Add the energy monitor first, it unlocks the per-room energy heatmap.');
  }

  const estimatedCost = tier.devices.reduce((sum, device) => sum + device.approxPriceUsd, 0);
  return { tier, notes, estimatedCost };
}

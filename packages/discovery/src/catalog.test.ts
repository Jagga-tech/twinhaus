import { describe, expect, it } from 'vitest';
import {
  DEVICE_CATALOG,
  searchCatalog,
  suggestForCategory,
  catalogCategories,
  catalogProtocols,
  catalogDocsUrl,
} from './catalog.js';

describe('device catalog', () => {
  it('covers every device category so a recommendation exists for each', () => {
    const categories = catalogCategories();
    for (const category of [
      'light',
      'switch',
      'lock',
      'climate',
      'sensor',
      'motion',
      'camera',
      'media',
      'cover',
      'other',
    ] as const) {
      expect(categories).toContain(category);
    }
  });

  it('every entry names the Home Assistant integration that adds it', () => {
    for (const device of DEVICE_CATALOG) {
      expect(device.integration.length).toBeGreaterThan(0);
      expect(catalogDocsUrl(device)).toBe(
        `https://www.home-assistant.io/integrations/${device.integration}`,
      );
    }
  });

  it('returns the full catalog for an empty query', () => {
    expect(searchCatalog('')).toHaveLength(DEVICE_CATALOG.length);
  });

  it('matches free text across brand, category, and protocol', () => {
    const locks = searchCatalog('lock');
    expect(locks.length).toBeGreaterThan(0);
    expect(locks.every((device) => device.category === 'lock')).toBe(true);

    const hue = searchCatalog('philips');
    expect(hue.every((device) => device.brand.toLowerCase().includes('philips'))).toBe(true);
  });

  it('requires every token to match, narrowing the results', () => {
    const zigbee = searchCatalog('zigbee');
    const zigbeeLights = searchCatalog('zigbee light');
    expect(zigbeeLights.length).toBeLessThan(zigbee.length);
    expect(zigbeeLights.every((device) => device.category === 'light')).toBe(true);
    expect(zigbeeLights.every((device) => device.protocols.includes('zigbee'))).toBe(true);
  });

  it('applies filters and sorts cheapest first', () => {
    const localLocks = searchCatalog('', { category: 'lock', setup: 'local' });
    expect(localLocks.every((device) => device.setup === 'local')).toBe(true);
    for (let i = 1; i < localLocks.length; i += 1) {
      expect(localLocks[i].approxPriceUsd).toBeGreaterThanOrEqual(localLocks[i - 1].approxPriceUsd);
    }
  });

  it('honors a price ceiling', () => {
    const cheap = searchCatalog('', { maxPriceUsd: 20 });
    expect(cheap.length).toBeGreaterThan(0);
    expect(cheap.every((device) => device.approxPriceUsd <= 20)).toBe(true);
  });

  it('suggests a local pick per category for the wizard', () => {
    const lock = suggestForCategory('lock');
    expect(lock?.category).toBe('lock');
    expect(lock?.setup).toBe('local');
  });

  it('exposes the protocols used across the catalog', () => {
    expect(catalogProtocols()).toContain('zigbee');
    expect(catalogProtocols()).toContain('matter');
  });
});

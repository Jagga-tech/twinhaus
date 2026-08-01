import { describe, expect, it } from 'vitest';
import type { CatalogDevice } from '@twinhaus/discovery';
import type { VirtualDevice } from '../store/types.js';
import { planSummary, virtualFromCatalog } from './plan.js';

function planned(overrides: Partial<VirtualDevice>): VirtualDevice {
  return {
    id: overrides.id ?? 'v',
    category: 'camera',
    label: 'Camera',
    roomId: 'r',
    position: { x: 0, z: 0 },
    rotationY: 0,
    rangeM: 6,
    fovDeg: 90,
    ...overrides,
  };
}

describe('virtualFromCatalog', () => {
  it('builds a priced planned device from a catalog product', () => {
    const product = {
      id: 'nuki-4',
      brand: 'Nuki',
      model: 'Smart Lock 4.0',
      category: 'lock',
      approxPriceUsd: 159,
      rangeM: 0,
    } as CatalogDevice;
    const draft = virtualFromCatalog(product, 'room1', { x: 1, z: 2 });
    expect(draft.label).toBe('Nuki Smart Lock 4.0');
    expect(draft.priceUsd).toBe(159);
    expect(draft.catalogId).toBe('nuki-4');
    expect(draft.roomId).toBe('room1');
  });
});

describe('planSummary', () => {
  it('collapses identical products into counted lines and totals the price', () => {
    const summary = planSummary([
      planned({ id: '1', label: 'Aqara Camera', priceUsd: 60 }),
      planned({ id: '2', label: 'Aqara Camera', priceUsd: 60 }),
      planned({ id: '3', label: 'Nuki Lock', category: 'lock', priceUsd: 159 }),
    ]);
    expect(summary.deviceCount).toBe(3);
    expect(summary.totalUsd).toBe(279);
    const camera = summary.lines.find((l) => l.label === 'Aqara Camera');
    expect(camera?.count).toBe(2);
    expect(camera?.lineTotalUsd).toBe(120);
    // Biggest line total first: Nuki ($159) outranks the camera pair ($120).
    expect(summary.lines[0].label).toBe('Nuki Lock');
  });

  it('counts unpriced generic placements without inflating the total', () => {
    const summary = planSummary([
      planned({ id: '1', label: 'Camera', priceUsd: undefined }),
      planned({ id: '2', label: 'Nuki Lock', category: 'lock', priceUsd: 159 }),
    ]);
    expect(summary.unpricedCount).toBe(1);
    expect(summary.totalUsd).toBe(159);
  });

  it('is empty for no devices', () => {
    expect(planSummary([])).toEqual({
      lines: [],
      deviceCount: 0,
      totalUsd: 0,
      unpricedCount: 0,
    });
  });
});

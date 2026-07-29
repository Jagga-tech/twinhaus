import { describe, expect, it } from 'vitest';
import { recommend, TIERS } from './recommendations.js';

describe('recommend', () => {
  it('returns the requested tier and sums its cost', () => {
    const result = recommend({ homeAgeYears: 10, ownership: 'own', budget: 'starter' });
    expect(result.tier.id).toBe('starter');
    const expected = TIERS.starter.devices.reduce((s, d) => s + d.approxPriceUsd, 0);
    expect(result.estimatedCost).toBe(expected);
  });

  it('adds a renter caveat when renting', () => {
    const result = recommend({ homeAgeYears: 10, ownership: 'rent', budget: 'mid' });
    expect(result.notes.some((n) => /renter/i.test(n))).toBe(true);
  });

  it('adds an old-wiring caveat for older homes', () => {
    const result = recommend({ homeAgeYears: 60, ownership: 'own', budget: 'starter' });
    expect(result.notes.some((n) => /wiring|neutral/i.test(n))).toBe(true);
  });

  it('full tier suggests the energy monitor first', () => {
    const result = recommend({ homeAgeYears: 5, ownership: 'own', budget: 'full' });
    expect(result.notes.some((n) => /energy monitor/i.test(n))).toBe(true);
  });
});

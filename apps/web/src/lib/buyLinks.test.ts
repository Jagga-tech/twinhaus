import { describe, expect, it } from 'vitest';
import { buyLinks } from './buyLinks.js';

describe('buyLinks', () => {
  it('builds retailer search links for a product query', () => {
    const links = buyLinks('smart video doorbell');
    expect(links.map((l) => l.retailer)).toEqual(['Google Shopping', 'Amazon', 'Best Buy']);
    expect(links[1].url).toBe('https://www.amazon.com/s?k=smart%20video%20doorbell');
  });

  it('url-encodes the query', () => {
    expect(buyLinks('nuki lock & sensor')[0].url).toContain('nuki%20lock%20%26%20sensor');
  });

  it('returns nothing for an empty query', () => {
    expect(buyLinks('   ')).toEqual([]);
  });
});

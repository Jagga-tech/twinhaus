/**
 * Turn a product query into "where to buy" links. Twinhaus never sells hardware and cannot scrape
 * arbitrary shops from the browser (CORS), so instead of faking a live price feed it hands back
 * real retailer search links for whatever the user is after. Deterministic, so it works for any
 * device the user names, and it is easy to test.
 */

export interface BuyLink {
  retailer: string;
  url: string;
}

/** Retailer search links for a product query, most useful first. */
export function buyLinks(query: string): BuyLink[] {
  const q = query.trim();
  if (!q) return [];
  const enc = encodeURIComponent(q);
  return [
    { retailer: 'Google Shopping', url: `https://www.google.com/search?tbm=shop&q=${enc}` },
    { retailer: 'Amazon', url: `https://www.amazon.com/s?k=${enc}` },
    { retailer: 'Best Buy', url: `https://www.bestbuy.com/site/searchpage.jsp?st=${enc}` },
  ];
}

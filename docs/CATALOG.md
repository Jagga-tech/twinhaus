# Device catalog, search everything you can add

Not every home starts with smart devices, and "what should I buy?" is the first question a retrofit
user asks. The catalog is Twinhaus's answer: a searchable, cross-brand list of devices you can add,
so the app, and the AI agent, can **recommend a real product** for any room, budget, or protocol.

Twinhaus never sells or provisions hardware. Every catalog entry points at the Home Assistant
integration that actually adds the device, so a recommendation always ends in HA's own add flow.

## Where it lives

- **`packages/discovery/src/catalog.ts`**, the `DEVICE_CATALOG` dataset plus `searchCatalog`,
  `suggestForCategory`, and the filter/lookup helpers. It sits in `@twinhaus/discovery` because it
  is the same domain as "Found near you": what Home Assistant can configure. Integration handlers
  match `normalize.ts`, so a device discovered on the network can be cross-referenced to its catalog
  entry.
- **`apps/web` to Catalog tab**, the browse UI: a search box, category / protocol / local-or-cloud
  filters, and a card per device. Each card links to HA's docs ("How to add") and can drop the
  device into the twin as a **simulated placement** to preview coverage before buying.
- **Recommendation wizard**, each recommended device now names a real catalog pick
  (`suggestForCategory`), and points to the Catalog tab for the full list.
- **AI agent**, the `search_device_catalog` tool lets the assistant answer "what smart lock should
  I buy?" from the same dataset. It is **read-only and advisory**: the agent recommends, the user
  adds the device through Home Assistant. There is no tool that can purchase, pair, or configure.

## The data model

```ts
interface CatalogDevice {
  id: string;
  brand: string;
  model: string;
  category: DeviceCategory; // light, switch, lock, climate, sensor, motion, camera, media, cover, other
  integration: string; // Home Assistant handler, also keys the docs URL
  protocols: Protocol[]; // wifi, ethernet, zigbee, zwave, thread, matter, bluetooth, cloud
  setup: 'local' | 'cloud'; // configured on the LAN, or via a vendor cloud account
  approxPriceUsd: number;
  rangeM: number; // coverage radius for a simulated placement (0 for non-spatial devices)
  note?: string;
}
```

The docs link is derived, never stored: `https://www.home-assistant.io/integrations/<integration>`.

## Searching

`searchCatalog(query, filter)` splits the query into tokens and requires **every** token to match
(against brand, model, category, integration, and protocols), then applies the optional filters and
sorts cheapest-first so approachable picks lead:

```ts
searchCatalog('local zigbee light'); // Zigbee bulbs configured on the LAN
searchCatalog('lock', { setup: 'local' }); // locks with no vendor cloud
searchCatalog('', { category: 'camera', maxPriceUsd: 60 }); // budget cameras
```

## Why it's curated, not scraped

The catalog is deliberately a hand-picked cross-section rather than a live scrape of a store or of
Home Assistant's full 2000+ integration list. That keeps it offline-first (no network call to
recommend a device), honest (every entry maps to a real HA integration we can vouch for), and small
enough to reason about. Adding a device is a one-object edit to `DEVICE_CATALOG`, contributions
welcome, especially local-first gear for older homes.

import { useMemo, useState } from 'react';
import {
  searchCatalog,
  catalogCategories,
  catalogProtocols,
  catalogDocsUrl,
  type CatalogDevice,
  type Protocol,
  type Setup,
} from '@twinhaus/discovery';
import { useTwinStore } from '../../store/twinStore.js';
import { polygonCentroid } from '../../lib/geometry.js';
import { virtualFromCatalog } from '../../lib/plan.js';
import type { DeviceCategory } from '../../store/types.js';

const CATEGORIES = catalogCategories();
const PROTOCOLS = catalogProtocols();
const SETUPS: Setup[] = ['local', 'cloud'];

/**
 * Browse the catalog of devices you can add. This is the "search everything we can recommend" layer
 *, Twinhaus never sells or provisions hardware, so each result links to Home Assistant's add flow
 * and can be dropped into the twin as a simulated placement to preview coverage before buying.
 */
export function DeviceCatalog() {
  const rooms = useTwinStore((state) => state.rooms);
  const addVirtualDevice = useTwinStore((state) => state.addVirtualDevice);
  const setSimulationVisible = useTwinStore((state) => state.setSimulationVisible);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<DeviceCategory | ''>('');
  const [protocol, setProtocol] = useState<Protocol | ''>('');
  const [setup, setSetup] = useState<Setup | ''>('');
  const [added, setAdded] = useState<string | null>(null);

  const results = useMemo(
    () =>
      searchCatalog(query, {
        category: category || undefined,
        protocol: protocol || undefined,
        setup: setup || undefined,
      }),
    [query, category, protocol, setup],
  );

  function simulate(device: CatalogDevice) {
    if (rooms.length === 0) {
      window.alert('Draw at least one room first, then simulate a device from the catalog.');
      return;
    }
    const room = rooms[0];
    const center = polygonCentroid(room.polygon);
    addVirtualDevice(virtualFromCatalog(device, room.id, center));
    setSimulationVisible(true);
    setAdded(device.id);
  }

  return (
    <div className="panel-block">
      <p className="hint">
        Search every device we can recommend. Twinhaus doesn&apos;t sell hardware, adding always
        happens in Home Assistant. Simulate one to preview it in your twin before you buy.
      </p>

      <input
        className="catalog-search"
        type="search"
        placeholder="Search brand, category, protocol..."
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      <div className="catalog-filters">
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as DeviceCategory | '')}
        >
          <option value="">All types</option>
          {CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          value={protocol}
          onChange={(event) => setProtocol(event.target.value as Protocol | '')}
        >
          <option value="">Any protocol</option>
          {PROTOCOLS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select value={setup} onChange={(event) => setSetup(event.target.value as Setup | '')}>
          <option value="">Local or cloud</option>
          {SETUPS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      <p className="hint catalog-count">
        {results.length} device{results.length === 1 ? '' : 's'}
      </p>

      <ul className="catalog-list">
        {results.map((device) => (
          <li key={device.id} className="catalog-item">
            <div className="catalog-meta">
              <div className="panel-row">
                <span className="catalog-name">
                  {device.brand} {device.model}
                </span>
                <span className="catalog-price">~${device.approxPriceUsd}</span>
              </div>
              <div className="catalog-chips">
                {device.protocols.map((value) => (
                  <span key={value} className="catalog-chip">
                    {value}
                  </span>
                ))}
                <span className={`catalog-chip setup-${device.setup}`}>{device.setup}</span>
              </div>
              {device.note && <p className="catalog-note">{device.note}</p>}
              <div className="catalog-actions">
                <button onClick={() => simulate(device)}>
                  {added === device.id ? 'Added to plan' : 'Simulate in twin'}
                </button>
                <a href={catalogDocsUrl(device)} target="_blank" rel="noreferrer">
                  How to add
                </a>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {results.length === 0 && (
        <p className="hint">
          No matches. Try a broader term, or clear the filters, the catalog spans lighting,
          switches, locks, climate, sensors, cameras, media, and shades.
        </p>
      )}
    </div>
  );
}

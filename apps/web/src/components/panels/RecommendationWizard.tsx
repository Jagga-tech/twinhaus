import { useState } from 'react';
import { useTwinStore } from '../../store/twinStore.js';
import { polygonCentroid } from '../../lib/geometry.js';
import { recommend, type Ownership, type Tier } from '../../lib/recommendations.js';
import { BluetoothQuickScan } from '../discovery/BluetoothQuickScan.js';

/**
 * The retrofit funnel. Asks a few questions about the home, recommends a device tier, and drops
 * the kit into the twin as simulated placements — turning "I have no smart devices" into a
 * concrete, coverage-checked shopping list. Nobody else does this.
 */
export function RecommendationWizard({ onClose }: { onClose: () => void }) {
  const rooms = useTwinStore((state) => state.rooms);
  const addVirtualDevice = useTwinStore((state) => state.addVirtualDevice);
  const setSimulationVisible = useTwinStore((state) => state.setSimulationVisible);

  const [homeAgeYears, setHomeAgeYears] = useState(20);
  const [ownership, setOwnership] = useState<Ownership>('own');
  const [budget, setBudget] = useState<Tier>('starter');
  const [placed, setPlaced] = useState(false);

  const result = recommend({ homeAgeYears, ownership, budget });

  function placeKit() {
    if (rooms.length === 0) {
      window.alert('Draw at least one room first, then re-run the wizard.');
      return;
    }
    // Spread the recommended devices across rooms so coverage is visible everywhere.
    result.tier.devices.forEach((device, index) => {
      const room = rooms[index % rooms.length];
      const center = polygonCentroid(room.polygon);
      addVirtualDevice({
        category: device.category,
        label: device.label,
        roomId: room.id,
        position: { x: center.x + (index % 2 === 0 ? 0.4 : -0.4), z: center.z },
        rotationY: 0,
        rangeM: device.rangeM,
        fovDeg: device.category === 'camera' ? 90 : 360,
      });
    });
    setSimulationVisible(true);
    setPlaced(true);
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings wizard" onClick={(event) => event.stopPropagation()}>
        <div className="settings-header">
          <h2>Device recommendation</h2>
          <button className="link" onClick={onClose}>
            Close
          </button>
        </div>

        <label>
          How old is the home? ({homeAgeYears} years)
          <input
            type="range"
            min={0}
            max={100}
            value={homeAgeYears}
            onChange={(event) => setHomeAgeYears(Number(event.target.value))}
          />
        </label>

        <label>
          Do you rent or own?
          <select
            value={ownership}
            onChange={(event) => setOwnership(event.target.value as Ownership)}
          >
            <option value="own">Own</option>
            <option value="rent">Rent</option>
          </select>
        </label>

        <label>
          Budget tier
          <select value={budget} onChange={(event) => setBudget(event.target.value as Tier)}>
            <option value="starter">Starter</option>
            <option value="mid">Mid</option>
            <option value="full">Full</option>
          </select>
        </label>

        <div className="wizard-result">
          <div className="panel-row">
            <strong>{result.tier.name} kit</strong>
            <span>~${result.estimatedCost}</span>
          </div>
          <p className="hint">{result.tier.blurb}</p>
          <ul className="recommend-list">
            {result.tier.devices.map((device, index) => (
              <li key={index}>
                {device.label} — ~${device.approxPriceUsd}
                {device.note ? ` · ${device.note}` : ''}
              </li>
            ))}
          </ul>
          {result.notes.map((note, index) => (
            <p key={index} className="wizard-note">
              💡 {note}
            </p>
          ))}
        </div>

        <div className="settings-actions">
          <button className="primary" onClick={placeKit}>
            Place kit in twin
          </button>
          {placed && <span className="hint">Placed — check coverage in the 3D view.</span>}
        </div>

        <div className="wizard-result">
          <h3>What's already nearby?</h3>
          <BluetoothQuickScan />
        </div>
      </div>
    </div>
  );
}

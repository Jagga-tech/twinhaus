import { useMemo } from 'react';
import { useTwinStore } from '../../store/twinStore.js';
import { computeRoomEnergy, heatColor } from '../../lib/energy.js';

/** Per-room power draw with a one-click jump to the 3D heatmap. HA has the data; nobody maps it. */
export function EnergySummary() {
  const rooms = useTwinStore((state) => state.rooms);
  const devices = useTwinStore((state) => state.devices);
  const entityStates = useTwinStore((state) => state.entityStates);
  const setViewMode = useTwinStore((state) => state.setViewMode);

  const energy = useMemo(
    () => computeRoomEnergy(rooms, devices, entityStates),
    [rooms, devices, entityStates],
  );

  const ranked = [...rooms].sort((a, b) => (energy.byRoom[b.id] ?? 0) - (energy.byRoom[a.id] ?? 0));

  return (
    <div className="panel-block">
      <div className="panel-row">
        <strong>{Math.round(energy.total)} W</strong>
        <button className="link" onClick={() => setViewMode('energy')}>
          Show heatmap
        </button>
      </div>
      {energy.max === 0 ? (
        <p className="hint">
          No power readings yet. Place a power/energy sensor (Emporia, Shelly, smart plug) in a room
          to light up the heatmap.
        </p>
      ) : (
        <ul className="bar-list">
          {ranked.map((room) => {
            const watts = energy.byRoom[room.id] ?? 0;
            const pct = energy.max > 0 ? (watts / energy.max) * 100 : 0;
            return (
              <li key={room.id}>
                <span className="bar-label">{room.name}</span>
                <span className="bar-track">
                  <span
                    className="bar-fill"
                    style={{ width: `${pct}%`, background: heatColor(pct / 100) }}
                  />
                </span>
                <span className="bar-value">{Math.round(watts)} W</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

import { useMemo } from 'react';
import { useTwinStore } from '../../store/twinStore.js';
import { buildingSummary } from '../../lib/buildingSummary.js';

/**
 * Whole-house rollup: rooms, devices, and power draw per floor, plus building-wide totals. Click a
 * floor row to jump the editor and 3D twin to it. Only shown once a home has more than one storey.
 */
export function BuildingSummaryPanel() {
  const levels = useTwinStore((state) => state.levels);
  const rooms = useTwinStore((state) => state.rooms);
  const devices = useTwinStore((state) => state.devices);
  const entityStates = useTwinStore((state) => state.entityStates);
  const activeLevelId = useTwinStore((state) => state.activeLevelId);
  const setActiveLevel = useTwinStore((state) => state.setActiveLevel);

  const summary = useMemo(
    () => buildingSummary(levels, rooms, devices, entityStates),
    [levels, rooms, devices, entityStates],
  );

  if (levels.length < 2) return null;

  return (
    <div className="panel-block">
      <h4 className="section-heading">Whole house</h4>
      <table className="house-table">
        <thead>
          <tr>
            <th>Floor</th>
            <th>Rooms</th>
            <th>Devices</th>
            <th>Power</th>
          </tr>
        </thead>
        <tbody>
          {summary.levels.map((row) => (
            <tr
              key={row.level.id}
              className={row.level.id === activeLevelId ? 'active' : ''}
              onClick={() => setActiveLevel(row.level.id)}
            >
              <td>{row.level.name}</td>
              <td>{row.roomCount}</td>
              <td>{row.deviceCount}</td>
              <td>{row.watts > 0 ? `${row.watts} W` : '—'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>{summary.floorCount} floors</td>
            <td>{summary.totalRooms}</td>
            <td>{summary.totalDevices}</td>
            <td>{summary.totalWatts > 0 ? `${summary.totalWatts} W` : '—'}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

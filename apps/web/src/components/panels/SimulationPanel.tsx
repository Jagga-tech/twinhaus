import { useMemo, useState } from 'react';
import { suggestForCategory } from '@twinhaus/discovery';
import { useTwinStore } from '../../store/twinStore.js';
import { polygonCentroid } from '../../lib/geometry.js';
import { planSummary, virtualFromCatalog } from '../../lib/plan.js';
import type { DeviceCategory } from '../../store/types.js';

const PLACEABLE: Array<{
  category: DeviceCategory;
  label: string;
  rangeM: number;
  fovDeg: number;
}> = [
  { category: 'camera', label: 'Camera', rangeM: 6, fovDeg: 90 },
  { category: 'motion', label: 'Motion sensor', rangeM: 5, fovDeg: 360 },
  { category: 'light', label: 'Light', rangeM: 0, fovDeg: 0 },
  { category: 'lock', label: 'Lock', rangeM: 0, fovDeg: 0 },
  { category: 'climate', label: 'Thermostat', rangeM: 0, fovDeg: 0 },
];

/**
 * Plan mode: design a home with no hardware, drop planned devices into rooms, preview their
 * coverage in 3D, and build a shopping list with an estimated total before spending a penny. Each
 * placement is matched to a real catalog product so the plan is priced; cameras and motion sensors
 * carry range/FOV you can tune. This is the "plan and simulate before you buy" wedge.
 */
export function SimulationPanel({ onOpenWizard }: { onOpenWizard: () => void }) {
  const rooms = useTwinStore((state) => state.rooms);
  const virtualDevices = useTwinStore((state) => state.virtualDevices);
  const addVirtualDevice = useTwinStore((state) => state.addVirtualDevice);
  const updateVirtualDevice = useTwinStore((state) => state.updateVirtualDevice);
  const removeVirtualDevice = useTwinStore((state) => state.removeVirtualDevice);
  const clearVirtualDevices = useTwinStore((state) => state.clearVirtualDevices);
  const setViewMode = useTwinStore((state) => state.setViewMode);

  const [category, setCategory] = useState<DeviceCategory>('camera');
  const [roomId, setRoomId] = useState('');

  const summary = useMemo(() => planSummary(virtualDevices), [virtualDevices]);

  function place() {
    const targetRoomId = roomId || rooms[0]?.id;
    const room = rooms.find((r) => r.id === targetRoomId);
    if (!room) {
      window.alert('Design a room first (Design tab), then plan a device.');
      return;
    }
    const spec = PLACEABLE.find((p) => p.category === category)!;
    const center = polygonCentroid(room.polygon);
    // Match a real catalog product so the plan is priced; fall back to a generic placement.
    const product = suggestForCategory(category);
    addVirtualDevice(
      product
        ? virtualFromCatalog(product, room.id, center)
        : {
            category,
            label: spec.label,
            roomId: room.id,
            position: center,
            rotationY: 0,
            rangeM: spec.rangeM,
            fovDeg: spec.fovDeg,
          },
    );
    setViewMode('normal');
  }

  return (
    <div className="panel-block">
      <button className="primary" onClick={onOpenWizard}>
        Recommend devices for my home
      </button>
      <p className="hint">No smart devices yet? The wizard suggests a kit and plans it here.</p>

      <div className="sim-form">
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as DeviceCategory)}
        >
          {PLACEABLE.map((spec) => (
            <option key={spec.category} value={spec.category}>
              {spec.label}
            </option>
          ))}
        </select>
        <select value={roomId} onChange={(event) => setRoomId(event.target.value)}>
          <option value="">First room</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>
        <button onClick={place}>Plan</button>
      </div>

      {summary.deviceCount > 0 && (
        <>
          <div className="panel-row">
            <h4>Shopping list</h4>
            <button className="link" onClick={clearVirtualDevices}>
              Clear all
            </button>
          </div>
          <ul className="plan-list">
            {summary.lines.map((line) => (
              <li key={`${line.label}-${line.unitPriceUsd}`} className="plan-line">
                <span className="plan-line-label">
                  {line.label}
                  {line.count > 1 ? ` x${line.count}` : ''}
                </span>
                <span className="plan-line-price">
                  {line.unitPriceUsd > 0 ? `$${line.lineTotalUsd}` : 'n/a'}
                </span>
              </li>
            ))}
          </ul>
          <div className="plan-total">
            <span>Estimated total</span>
            <strong>${summary.totalUsd}</strong>
          </div>
          {summary.unpricedCount > 0 && (
            <p className="hint">
              {summary.unpricedCount} planned device{summary.unpricedCount === 1 ? '' : 's'} without
              a price. Add from the Catalog tab to price{' '}
              {summary.unpricedCount === 1 ? 'it' : 'them'}.
            </p>
          )}
        </>
      )}

      {virtualDevices.length > 0 && (
        <>
          <h4>Placed ({virtualDevices.length})</h4>
          <ul className="sim-list">
            {virtualDevices.map((device) => (
              <li key={device.id}>
                <div className="panel-row">
                  <span>{device.label}</span>
                  <button className="link" onClick={() => removeVirtualDevice(device.id)}>
                    remove
                  </button>
                </div>
                {device.rangeM > 0 && (
                  <div className="sim-sliders">
                    <label>
                      Range {device.rangeM}m
                      <input
                        type="range"
                        min={1}
                        max={15}
                        value={device.rangeM}
                        onChange={(event) =>
                          updateVirtualDevice(device.id, { rangeM: Number(event.target.value) })
                        }
                      />
                    </label>
                    {device.category === 'camera' && (
                      <label>
                        Aim {Math.round((device.rotationY * 180) / Math.PI)}°
                        <input
                          type="range"
                          min={0}
                          max={360}
                          value={Math.round((device.rotationY * 180) / Math.PI)}
                          onChange={(event) =>
                            updateVirtualDevice(device.id, {
                              rotationY: (Number(event.target.value) * Math.PI) / 180,
                            })
                          }
                        />
                      </label>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

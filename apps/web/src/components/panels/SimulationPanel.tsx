import { useState } from 'react';
import { useTwinStore } from '../../store/twinStore.js';
import { polygonCentroid } from '../../lib/geometry.js';
import { CATEGORY_GLYPH } from '../../lib/deviceCategory.js';
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
 * Simulation mode: drop virtual (not-yet-purchased) devices into rooms and see their coverage
 * in 3D before spending money. Cameras and motion sensors carry range/FOV; rotate a camera to
 * aim it. This is the "simulate before you buy" wedge.
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

  function place() {
    const targetRoomId = roomId || rooms[0]?.id;
    const room = rooms.find((r) => r.id === targetRoomId);
    if (!room) {
      window.alert('Draw a room first.');
      return;
    }
    const spec = PLACEABLE.find((p) => p.category === category)!;
    addVirtualDevice({
      category,
      label: spec.label,
      roomId: room.id,
      position: polygonCentroid(room.polygon),
      rotationY: 0,
      rangeM: spec.rangeM,
      fovDeg: spec.fovDeg,
    });
    setViewMode('normal');
  }

  return (
    <div className="panel-block">
      <button className="primary" onClick={onOpenWizard}>
        Recommend devices for my home →
      </button>
      <p className="hint">No smart devices yet? The wizard suggests a kit and places it here.</p>

      <div className="sim-form">
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value as DeviceCategory)}
        >
          {PLACEABLE.map((spec) => (
            <option key={spec.category} value={spec.category}>
              {CATEGORY_GLYPH[spec.category]} {spec.label}
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
        <button onClick={place}>Place</button>
      </div>

      {virtualDevices.length > 0 && (
        <>
          <div className="panel-row">
            <h4>Simulated ({virtualDevices.length})</h4>
            <button className="link" onClick={clearVirtualDevices}>
              Clear all
            </button>
          </div>
          <ul className="sim-list">
            {virtualDevices.map((device) => (
              <li key={device.id}>
                <div className="panel-row">
                  <span>
                    {CATEGORY_GLYPH[device.category]} {device.label}
                  </span>
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

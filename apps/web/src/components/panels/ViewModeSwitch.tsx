import { useTwinStore } from '../../store/twinStore.js';
import type { ViewMode } from '../../store/types.js';

const MODES: Array<{ id: ViewMode; label: string }> = [
  { id: 'normal', label: 'Normal' },
  { id: 'energy', label: 'Energy' },
  { id: 'security', label: 'Security' },
];

/** Switches how the 3D twin is shaded, plus a toggle for simulated (not-yet-bought) devices. */
export function ViewModeSwitch() {
  const viewMode = useTwinStore((state) => state.viewMode);
  const setViewMode = useTwinStore((state) => state.setViewMode);
  const simulationVisible = useTwinStore((state) => state.simulationVisible);
  const setSimulationVisible = useTwinStore((state) => state.setSimulationVisible);
  const hasVirtual = useTwinStore((state) => state.virtualDevices.length > 0);

  return (
    <div className="view-switch">
      <div className="mode-switch">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            className={viewMode === mode.id ? 'active' : ''}
            onClick={() => setViewMode(mode.id)}
          >
            {mode.label}
          </button>
        ))}
      </div>
      {hasVirtual && (
        <label className="toggle">
          <input
            type="checkbox"
            checked={simulationVisible}
            onChange={(event) => setSimulationVisible(event.target.checked)}
          />
          Simulated
        </label>
      )}
    </div>
  );
}

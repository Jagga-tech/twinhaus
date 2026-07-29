import { useState } from 'react';
import { useTwinStore } from '../../store/twinStore.js';
import { haClient } from '../../hooks/useHaConnection.js';
import { entityLabel, entitySummary } from '../../lib/deviceState.js';
import { quickControls } from '../../lib/deviceControl.js';

/**
 * Click a device in the twin to inspect and control it — the same Home Assistant service calls
 * the agent makes, exposed as one-tap buttons. Appears as a floating card over the viewer.
 */
export function DeviceInspector() {
  const selectedDeviceId = useTwinStore((state) => state.selectedDeviceId);
  const entityStates = useTwinStore((state) => state.entityStates);
  const setSelectedDeviceId = useTwinStore((state) => state.setSelectedDeviceId);
  const [error, setError] = useState<string | null>(null);

  if (!selectedDeviceId) return null;
  const state = entityStates[selectedDeviceId];

  async function run(index: number) {
    if (!state) return;
    const control = quickControls(state)[index];
    setError(null);
    try {
      await haClient.callService(control.call);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="inspector">
      <div className="inspector-header">
        <strong>{entityLabel(selectedDeviceId, state)}</strong>
        <button className="link" onClick={() => setSelectedDeviceId(null)}>
          ✕
        </button>
      </div>
      {state ? (
        <>
          <p className="inspector-state">{entitySummary(state)}</p>
          <div className="inspector-controls">
            {quickControls(state).map((control, index) => (
              <button
                key={control.label}
                className={control.active ? 'active' : ''}
                onClick={() => run(index)}
              >
                {control.label}
              </button>
            ))}
            {quickControls(state).length === 0 && (
              <span className="hint">No quick controls for this device type.</span>
            )}
          </div>
        </>
      ) : (
        <p className="hint">No live state — connect Home Assistant to control this device.</p>
      )}
      {error && <p className="settings-error">{error}</p>}
    </div>
  );
}

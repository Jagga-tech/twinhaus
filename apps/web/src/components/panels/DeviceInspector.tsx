import { useState } from 'react';
import { entityDomain, type CallServiceOptions } from '@twinhaus/ha-bridge';
import { useTwinStore } from '../../store/twinStore.js';
import { activeProvider } from '../../lib/provider/index.js';
import { entityLabel, entitySummary } from '../../lib/deviceState.js';
import { quickControls } from '../../lib/deviceControl.js';
import { LIGHT_SWATCHES, setBrightnessCall, setColorCall } from '../../lib/lightControl.js';

/**
 * Click a device in the twin to inspect and control it, the same Home Assistant service calls
 * the agent makes, exposed as one-tap buttons. Lights also get a brightness slider and a colour
 * palette. Appears as a floating card over the viewer.
 */
export function DeviceInspector() {
  const selectedDeviceId = useTwinStore((state) => state.selectedDeviceId);
  const entityStates = useTwinStore((state) => state.entityStates);
  const setSelectedDeviceId = useTwinStore((state) => state.setSelectedDeviceId);
  const [error, setError] = useState<string | null>(null);

  if (!selectedDeviceId) return null;
  const state = entityStates[selectedDeviceId];
  const isLight = entityDomain(selectedDeviceId) === 'light';
  const brightnessPct = state
    ? Math.round((Number(state.attributes.brightness ?? 0) / 255) * 100)
    : 0;

  async function send(call: CallServiceOptions) {
    setError(null);
    try {
      await activeProvider().callService(call);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="inspector">
      <div className="inspector-header">
        <strong>{entityLabel(selectedDeviceId, state)}</strong>
        <button className="link" onClick={() => setSelectedDeviceId(null)}>
          Close
        </button>
      </div>
      {state ? (
        <>
          <p className="inspector-state">{entitySummary(state)}</p>
          <div className="inspector-controls">
            {quickControls(state).map((control) => (
              <button
                key={control.label}
                className={control.active ? 'active' : ''}
                onClick={() => send(control.call)}
              >
                {control.label}
              </button>
            ))}
            {quickControls(state).length === 0 && (
              <span className="hint">No quick controls for this device type.</span>
            )}
          </div>

          {isLight && (
            <div className="inspector-light">
              <label className="inspector-slider">
                Brightness {brightnessPct}%
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={brightnessPct}
                  onChange={(event) =>
                    send(setBrightnessCall(selectedDeviceId, Number(event.target.value)))
                  }
                />
              </label>
              <div className="inspector-swatches">
                {LIGHT_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.name}
                    className="swatch"
                    title={swatch.name}
                    style={{ background: swatch.css }}
                    onClick={() => send(setColorCall(selectedDeviceId, swatch.rgb))}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="hint">No live state, connect a backend to control this device.</p>
      )}
      {error && <p className="settings-error">{error}</p>}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import {
  ConfigFlowController,
  type DiscoveredDevice,
  type FlowField,
  type FlowState,
} from '@twinhaus/discovery';
import { createDiscoveryTransport } from '../../lib/discoveryTransport.js';

/**
 * Runs a discovered device's Home Assistant config flow to completion. Renders any required form
 * (PIN, credentials, options) from the flow's own schema. On success, hands the device back so
 * the caller can start room placement. The user drives every step — nothing completes on its own.
 */
export function AddDeviceModal({
  device,
  onClose,
  onAdded,
}: {
  device: DiscoveredDevice;
  onClose: () => void;
  onAdded: (device: DiscoveredDevice) => void;
}) {
  const controllerRef = useRef<ConfigFlowController>();
  const [flow, setFlow] = useState<FlowState>({ status: 'progress' });
  const [inputs, setInputs] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new ConfigFlowController(createDiscoveryTransport());
    controllerRef.current = controller;
    controller.begin(device.id).then(handleState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device.id]);

  function handleState(next: FlowState) {
    setFlow(next);
    if (next.status === 'done') onAdded(device);
  }

  async function submit() {
    if (!controllerRef.current) return;
    setBusy(true);
    handleState(await controllerRef.current.submit(inputs));
    setBusy(false);
  }

  async function close() {
    if (flow.status === 'form') await controllerRef.current?.cancel();
    onClose();
  }

  return (
    <div className="settings-overlay" onClick={close}>
      <div className="settings add-modal" onClick={(event) => event.stopPropagation()}>
        <div className="settings-header">
          <h2>Add {device.name}</h2>
          <button className="link" onClick={close}>
            Close
          </button>
        </div>
        <p className="hint">
          {device.brand} · via {device.source}
        </p>

        {flow.status === 'progress' && <p>Starting setup…</p>}

        {flow.status === 'form' && (
          <>
            {flow.description && <p className="hint">{flow.description}</p>}
            {flow.fields.length === 0 && <p>Confirm to add this device to Home Assistant.</p>}
            {flow.fields.map((field) => (
              <FieldInput
                key={field.name}
                field={field}
                value={inputs[field.name]}
                error={flow.errors[field.name]}
                onChange={(value) => setInputs((prev) => ({ ...prev, [field.name]: value }))}
              />
            ))}
            <div className="settings-actions">
              <button className="primary" onClick={submit} disabled={busy}>
                {busy ? 'Adding…' : flow.fields.length ? 'Submit' : 'Confirm'}
              </button>
            </div>
          </>
        )}

        {flow.status === 'aborted' && (
          <p className="settings-error">Home Assistant stopped setup: {flow.reason}.</p>
        )}
        {flow.status === 'error' && <p className="settings-error">{flow.message}</p>}
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  error,
  onChange,
}: {
  field: FlowField;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
}) {
  return (
    <label>
      {field.label}
      {field.type === 'boolean' ? (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
        />
      ) : field.type === 'select' ? (
        <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={
            field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'
          }
          value={String(value ?? '')}
          onChange={(e) =>
            onChange(field.type === 'number' ? Number(e.target.value) : e.target.value)
          }
        />
      )}
      {error && <span className="settings-error">{error}</span>}
    </label>
  );
}

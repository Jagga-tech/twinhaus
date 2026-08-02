import { useState } from 'react';
import type { DiscoveredDevice, DiscoverySource } from '@twinhaus/discovery';
import { useTwinStore } from '../../store/twinStore.js';
import { syntheticEntityId } from '../../lib/discoveryPlacement.js';
import { AddDeviceModal } from './AddDeviceModal.js';

const SOURCE_CHIP: Record<DiscoverySource, string> = {
  bluetooth: 'Bluetooth',
  zeroconf: 'WiFi',
  ssdp: 'WiFi',
  dhcp: 'WiFi',
  usb: 'USB',
  other: 'Network',
};

/**
 * "Found near you": devices Home Assistant has discovered but not yet configured. One click adds
 * a device (running its config flow), then drops straight into room placement in the 3D twin.
 */
export function FoundNearYou() {
  const discovered = useTwinStore((state) => state.discovered);
  const connectionStatus = useTwinStore((state) => state.connectionStatus);
  const setPendingPlacement = useTwinStore((state) => state.setPendingPlacement);
  const [adding, setAdding] = useState<DiscoveredDevice | null>(null);

  function onAdded(device: DiscoveredDevice) {
    setAdding(null);
    setPendingPlacement({ entityId: syntheticEntityId(device), label: device.name });
  }

  if (connectionStatus !== 'connected') {
    return (
      <p className="hint">
        Connect Home Assistant to see devices discovered on your network. Discovery runs in HA,
        Twinhaus never scans hardware directly.
      </p>
    );
  }

  if (discovered.length === 0) {
    return (
      <div className="panel-block">
        <p className="hint">
          Nothing new right now. Home Assistant automatically finds devices over WiFi (mDNS/SSDP/
          DHCP) and Bluetooth, new gear usually appears here within seconds of powering on.
        </p>
        <p className="hint">
          Bluetooth range is limited. To cover a whole house, add ESPHome Bluetooth proxies, see{' '}
          <a
            href="https://github.com/Jagga-tech/twinhaus/blob/main/docs/DISCOVERY.md"
            target="_blank"
            rel="noreferrer"
          >
            the discovery guide
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="panel-block">
      <ul className="found-list">
        {discovered.map((device) => (
          <li key={device.id} className="found-item">
            <span className="found-meta">
              <span className="found-name">{device.name}</span>
              <span className="found-brand">{device.brand}</span>
            </span>
            <span className={`source-chip source-${device.source}`}>
              {SOURCE_CHIP[device.source]}
            </span>
            <button className="primary" onClick={() => setAdding(device)}>
              Add
            </button>
          </li>
        ))}
      </ul>

      {adding && (
        <AddDeviceModal device={adding} onClose={() => setAdding(null)} onAdded={onAdded} />
      )}
    </div>
  );
}

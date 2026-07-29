import { useState } from 'react';
import { useTwinStore } from '../../store/twinStore.js';
import { haClient } from '../../hooks/useHaConnection.js';
import { buildHomeScan, type HomeScanResult } from '../../lib/homeScan.js';

type ScanState =
  | { status: 'idle' }
  | { status: 'scanning' }
  | { status: 'preview'; result: HomeScanResult }
  | { status: 'error'; message: string };

/**
 * Scan the home straight from Home Assistant — no drawing. HA already knows the user's rooms
 * (areas) and which device lives in which, so this reads the registries, generates a room per area,
 * and drops every device into place. The user previews the result, then applies it to the twin.
 */
export function HomeScanPanel() {
  const connectionStatus = useTwinStore((state) => state.connectionStatus);
  const rooms = useTwinStore((state) => state.rooms);
  const importTwin = useTwinStore((state) => state.importTwin);

  const [scan, setScan] = useState<ScanState>({ status: 'idle' });

  async function runScan() {
    setScan({ status: 'scanning' });
    try {
      const [areas, devices, entities] = await Promise.all([
        haClient.listAreas(),
        haClient.listDeviceRegistry(),
        haClient.listEntityRegistry(),
      ]);
      if (areas.length === 0) {
        setScan({
          status: 'error',
          message: 'No areas found in Home Assistant. Add areas in HA (Settings → Areas) first.',
        });
        return;
      }
      setScan({ status: 'preview', result: buildHomeScan(areas, devices, entities) });
    } catch (err) {
      setScan({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  function apply(result: HomeScanResult) {
    if (rooms.length > 0 && !window.confirm('Replace the current floor plan with the scan?')) {
      return;
    }
    importTwin(result.model, 'replace');
    setScan({ status: 'idle' });
  }

  if (connectionStatus !== 'connected') {
    return (
      <div className="panel-block">
        <h4>Scan from Home Assistant</h4>
        <p className="hint">
          Connect Home Assistant to scan your home automatically — no drawing. It builds a room for
          each HA area and places every device where it already lives.
        </p>
      </div>
    );
  }

  return (
    <div className="panel-block">
      <h4>Scan from Home Assistant</h4>
      <p className="hint">
        Don&apos;t want to draw? Generate the whole layout from your HA areas and drop every device
        into its room automatically.
      </p>

      {scan.status !== 'preview' && (
        <button className="primary" onClick={runScan} disabled={scan.status === 'scanning'}>
          {scan.status === 'scanning' ? 'Scanning…' : 'Scan my home'}
        </button>
      )}

      {scan.status === 'error' && <p className="settings-error">{scan.message}</p>}

      {scan.status === 'preview' && (
        <div className="scan-preview">
          <p>
            Found <strong>{scan.result.roomCount}</strong> room
            {scan.result.roomCount === 1 ? '' : 's'} and placed{' '}
            <strong>{scan.result.placedCount}</strong> device
            {scan.result.placedCount === 1 ? '' : 's'}.
          </p>
          {scan.result.skippedCount > 0 && (
            <p className="hint">
              {scan.result.skippedCount} device{scan.result.skippedCount === 1 ? '' : 's'} had no
              area in HA and {scan.result.skippedCount === 1 ? 'was' : 'were'} skipped — assign them
              an area in Home Assistant, then rescan.
            </p>
          )}
          <p className="hint">
            Rooms are laid out in a tidy grid as a starting point — drag walls in the Plan tab to
            match your real layout.
          </p>
          <div className="import-actions">
            <button className="primary" onClick={() => apply(scan.result)}>
              Apply to twin
            </button>
            <button className="link" onClick={() => setScan({ status: 'idle' })}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

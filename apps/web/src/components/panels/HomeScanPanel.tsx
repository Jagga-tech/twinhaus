import { useState } from 'react';
import { useTwinStore } from '../../store/twinStore.js';
import { activeProvider } from '../../lib/provider/index.js';
import {
  applyReview,
  buildHomeScan,
  type HomeScanResult,
  type ScanReview,
} from '../../lib/homeScan.js';

type ScanState =
  | { status: 'idle' }
  | { status: 'scanning' }
  | { status: 'preview'; result: HomeScanResult }
  | { status: 'error'; message: string };

const EMPTY_REVIEW: ScanReview = { roomNames: {}, assignments: {}, excluded: [] };

/**
 * Scan the home straight from Home Assistant, no drawing. HA already knows the user's rooms
 * (areas) and which device lives in which, so this reads the registries, generates a room per area,
 * and drops every device into place. The user reviews and tweaks the result, then applies it.
 */
export function HomeScanPanel() {
  const connectionStatus = useTwinStore((state) => state.connectionStatus);
  const rooms = useTwinStore((state) => state.rooms);
  const importTwin = useTwinStore((state) => state.importTwin);

  const [scan, setScan] = useState<ScanState>({ status: 'idle' });
  const [review, setReview] = useState<ScanReview>(EMPTY_REVIEW);

  async function runScan() {
    const registry = activeProvider().registry;
    if (!registry) {
      setScan({
        status: 'error',
        message: `The ${activeProvider().label} backend can't auto-scan rooms. Draw your plan, or connect Home Assistant.`,
      });
      return;
    }
    setScan({ status: 'scanning' });
    try {
      const [areas, devices, entities, floors] = await Promise.all([
        registry.listAreas(),
        registry.listDeviceRegistry(),
        registry.listEntityRegistry(),
        registry.listFloors().catch(() => []),
      ]);
      if (areas.length === 0) {
        setScan({
          status: 'error',
          message: 'No areas found in Home Assistant. Add areas in HA (Settings → Areas) first.',
        });
        return;
      }
      setReview(EMPTY_REVIEW);
      setScan({ status: 'preview', result: buildHomeScan(areas, devices, entities, floors) });
    } catch (err) {
      setScan({ status: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  function apply(result: HomeScanResult) {
    if (rooms.length > 0 && !window.confirm('Replace the current floor plan with the scan?')) {
      return;
    }
    importTwin(applyReview(result, review), 'replace');
    setScan({ status: 'idle' });
    setReview(EMPTY_REVIEW);
  }

  function renameRoom(roomId: string, name: string) {
    setReview((prev) => ({ ...prev, roomNames: { ...prev.roomNames, [roomId]: name } }));
  }

  function reassign(entityId: string, roomId: string) {
    setReview((prev) => ({ ...prev, assignments: { ...prev.assignments, [entityId]: roomId } }));
  }

  function toggleExcluded(entityId: string) {
    setReview((prev) => ({
      ...prev,
      excluded: prev.excluded.includes(entityId)
        ? prev.excluded.filter((id) => id !== entityId)
        : [...prev.excluded, entityId],
    }));
  }

  if (connectionStatus !== 'connected') {
    return (
      <div className="panel-block">
        <h4>Scan from Home Assistant</h4>
        <p className="hint">
          Connect Home Assistant to scan your home automatically, no drawing. It builds a room for
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
        <ScanReviewList
          result={scan.result}
          review={review}
          onRenameRoom={renameRoom}
          onReassign={reassign}
          onToggleExcluded={toggleExcluded}
          onApply={() => apply(scan.result)}
          onCancel={() => setScan({ status: 'idle' })}
        />
      )}
    </div>
  );
}

interface ReviewProps {
  result: HomeScanResult;
  review: ScanReview;
  onRenameRoom: (roomId: string, name: string) => void;
  onReassign: (entityId: string, roomId: string) => void;
  onToggleExcluded: (entityId: string) => void;
  onApply: () => void;
  onCancel: () => void;
}

/** The review step: rename rooms, move a device to another room, or drop one before applying. */
function ScanReviewList({
  result,
  review,
  onRenameRoom,
  onReassign,
  onToggleExcluded,
  onApply,
  onCancel,
}: ReviewProps) {
  const { rooms, devices } = result.model;
  const kept = devices.filter((device) => !review.excluded.includes(device.entityId)).length;

  return (
    <div className="scan-preview">
      <p>
        Found <strong>{result.roomCount}</strong> room{result.roomCount === 1 ? '' : 's'} and{' '}
        <strong>{kept}</strong> device{kept === 1 ? '' : 's'} to place. Review and tweak below.
      </p>
      {result.skippedCount > 0 && (
        <p className="hint">
          {result.skippedCount} device{result.skippedCount === 1 ? '' : 's'} had no area in HA and{' '}
          {result.skippedCount === 1 ? 'was' : 'were'} skipped.
        </p>
      )}

      <h5 className="scan-subhead">Rooms</h5>
      <div className="scan-rooms">
        {rooms.map((room) => (
          <input
            key={room.id}
            className="scan-room-name"
            value={review.roomNames[room.id] ?? room.name}
            onChange={(event) => onRenameRoom(room.id, event.target.value)}
          />
        ))}
      </div>

      <h5 className="scan-subhead">Devices</h5>
      <ul className="scan-devices">
        {devices.map((device) => {
          const excluded = review.excluded.includes(device.entityId);
          return (
            <li key={device.entityId} className={excluded ? 'scan-device excluded' : 'scan-device'}>
              <span className="scan-device-id">{device.entityId}</span>
              <select
                value={review.assignments[device.entityId] ?? device.roomId}
                disabled={excluded}
                onChange={(event) => onReassign(device.entityId, event.target.value)}
              >
                {rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {review.roomNames[room.id] ?? room.name}
                  </option>
                ))}
              </select>
              <button className="link" onClick={() => onToggleExcluded(device.entityId)}>
                {excluded ? 'keep' : 'drop'}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="import-actions">
        <button className="primary" onClick={onApply}>
          Apply to twin
        </button>
        <button className="link" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

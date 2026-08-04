import { useMemo } from 'react';
import { useTwinStore } from '../../store/twinStore.js';
import { positioningStatus } from '../../lib/positioningSources.js';
import { entityLabel } from '../../lib/deviceState.js';
import { roomPresence } from '../../lib/presence.js';

const DOCS = 'https://github.com/Jagga-tech/twinhaus/blob/main/docs/POSITIONING.md';

/**
 * Setup helper for live positioning "from distance". Guides the user from nothing (add Bluetooth
 * proxies) through to ready (enough placed anchors to trilaterate), flags anchors that a distance
 * sensor references but that haven't been placed in the twin yet, and once live, shows per-device
 * confidence and an environment-calibration slider.
 */
export function PositioningPanel() {
  const connectionStatus = useTwinStore((state) => state.connectionStatus);
  const devices = useTwinStore((state) => state.devices);
  const entityStates = useTwinStore((state) => state.entityStates);
  const livePositions = useTwinStore((state) => state.livePositions);
  const positioningScale = useTwinStore((state) => state.positioningScale);
  const setPositioningScale = useTwinStore((state) => state.setPositioningScale);

  const rooms = useTwinStore((state) => state.rooms);
  const status = useMemo(() => positioningStatus(devices, entityStates), [devices, entityStates]);
  const tracked = useMemo(
    () => status.targets.map((id) => ({ id, estimate: livePositions[id] })),
    [status.targets, livePositions],
  );
  const presence = useMemo(
    () => roomPresence(rooms, livePositions, entityStates),
    [rooms, livePositions, entityStates],
  );

  if (connectionStatus !== 'connected') return null;

  return (
    <div className="panel-block">
      {presence.length > 0 && (
        <div className="presence-block">
          <h4>Who is where</h4>
          <ul className="track-list">
            {presence.map((p) => (
              <li key={p.entityId} className="track-item">
                <span className="track-name">{p.label}</span>
                <span className="track-confidence">{p.roomName ?? 'elsewhere'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h4>Live positioning (from distance)</h4>

      {status.anchorsReferenced.length === 0 ? (
        <p className="hint">
          Track where devices actually are within a room by adding Bluetooth proxies. Flash a few
          ESP32s, place them in the twin, and their distance readings move each device&apos;s dot
          live. See the{' '}
          <a href={DOCS} target="_blank" rel="noreferrer">
            positioning guide
          </a>
          .
        </p>
      ) : (
        <>
          <p className={status.ready ? 'positioning-ready' : 'hint'}>
            {status.ready ? 'Ready, ' : ''}
            {status.anchorsPlaced.length} of {status.anchorsReferenced.length} anchor
            {status.anchorsReferenced.length === 1 ? '' : 's'} placed, tracking{' '}
            {status.targets.length} device{status.targets.length === 1 ? '' : 's'}.
            {!status.ready && status.anchorsPlaced.length < 3
              ? ' Three placed anchors are needed to trilaterate.'
              : ''}
          </p>
          {status.anchorsMissing.length > 0 && (
            <p className="hint">
              Place these anchors in the twin (they&apos;re referenced but not positioned):{' '}
              {status.anchorsMissing.join(', ')}.
            </p>
          )}

          {tracked.length > 0 && (
            <ul className="track-list">
              {tracked.map(({ id, estimate }) => (
                <li key={id} className="track-item">
                  <span className="track-name">{entityLabel(id, entityStates[id])}</span>
                  {estimate ? (
                    <span className={`track-confidence ${confidenceClass(estimate.confidence)}`}>
                      {estimate.method === 'trilateration' ? 'fixed' : 'approx'} ,{' '}
                      {Math.round(estimate.confidence * 100)}%
                    </span>
                  ) : (
                    <span className="track-confidence track-low">no fix</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          <label className="calibration">
            <span className="calibration-label">
              Environment calibration
              <span className="calibration-value">x{positioningScale.toFixed(2)}</span>
            </span>
            <input
              type="range"
              min={0.6}
              max={1.4}
              step={0.05}
              value={positioningScale}
              onChange={(event) => setPositioningScale(Number(event.target.value))}
            />
            <span className="hint">
              Nudge until a stationary device&apos;s dot lands where it really is, walls make BLE
              read long, so lower it if dots sit too far out.
            </span>
          </label>
        </>
      )}
    </div>
  );
}

function confidenceClass(confidence: number): string {
  if (confidence >= 0.66) return 'track-high';
  if (confidence >= 0.33) return 'track-mid';
  return 'track-low';
}

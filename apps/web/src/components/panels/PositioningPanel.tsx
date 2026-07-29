import { useMemo } from 'react';
import { useTwinStore } from '../../store/twinStore.js';
import { positioningStatus } from '../../lib/positioningSources.js';

const DOCS = 'https://github.com/Jagga-tech/twinhaus/blob/main/docs/POSITIONING.md';

/**
 * Setup helper for live positioning "from distance". Guides the user from nothing (add Bluetooth
 * proxies) through to ready (enough placed anchors to trilaterate), and flags anchors that a
 * distance sensor references but that haven't been placed in the twin yet.
 */
export function PositioningPanel() {
  const connectionStatus = useTwinStore((state) => state.connectionStatus);
  const devices = useTwinStore((state) => state.devices);
  const entityStates = useTwinStore((state) => state.entityStates);

  const status = useMemo(() => positioningStatus(devices, entityStates), [devices, entityStates]);

  if (connectionStatus !== 'connected') return null;

  return (
    <div className="panel-block">
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
            {status.ready ? '✓ Ready — ' : ''}
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
        </>
      )}
    </div>
  );
}

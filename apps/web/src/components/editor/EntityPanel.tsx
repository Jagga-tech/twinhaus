import { useMemo } from 'react';
import { useTwinStore } from '../../store/twinStore.js';
import { entityLabel, isSupportedDomain } from '../../lib/deviceState.js';

/**
 * Lists Home Assistant entities and lets you drop unplaced ones into rooms. Select an entity
 * here, then click a room in the editor to place it — that's how devices enter the twin.
 */
export function EntityPanel() {
  const entityStates = useTwinStore((state) => state.entityStates);
  const devices = useTwinStore((state) => state.devices);
  const selectedEntityId = useTwinStore((state) => state.selectedEntityId);
  const setSelectedEntityId = useTwinStore((state) => state.setSelectedEntityId);
  const setEditorMode = useTwinStore((state) => state.setEditorMode);
  const unplaceDevice = useTwinStore((state) => state.unplaceDevice);

  const placedIds = useMemo(() => new Set(devices.map((device) => device.entityId)), [devices]);

  const supported = useMemo(
    () =>
      Object.values(entityStates)
        .filter((state) => isSupportedDomain(state.entity_id))
        .sort((a, b) => a.entity_id.localeCompare(b.entity_id)),
    [entityStates],
  );

  const unplaced = supported.filter((state) => !placedIds.has(state.entity_id));

  function select(entityId: string) {
    setSelectedEntityId(entityId);
    setEditorMode('place');
  }

  if (supported.length === 0) {
    return (
      <div className="entity-panel">
        <p className="hint">Connect Home Assistant to see your devices here.</p>
      </div>
    );
  }

  return (
    <div className="entity-panel">
      <h4>Unplaced devices ({unplaced.length})</h4>
      <ul>
        {unplaced.map((state) => (
          <li key={state.entity_id}>
            <button
              className={selectedEntityId === state.entity_id ? 'entity selected' : 'entity'}
              onClick={() => select(state.entity_id)}
            >
              {entityLabel(state.entity_id, state)}
              <span className="entity-id">{state.entity_id}</span>
            </button>
          </li>
        ))}
        {unplaced.length === 0 && <li className="hint">All devices placed.</li>}
      </ul>

      {devices.length > 0 && (
        <>
          <h4>Placed ({devices.length})</h4>
          <ul>
            {devices.map((device) => (
              <li key={device.entityId} className="entity-placed">
                {entityLabel(device.entityId, entityStates[device.entityId])}
                <button className="link" onClick={() => unplaceDevice(device.entityId)}>
                  remove
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

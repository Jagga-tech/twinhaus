import { useTwinStore } from '../../store/twinStore.js';
import { entityLabel } from '../../lib/deviceState.js';

/**
 * The spatial security view: a timeline of device transitions (motion, doors, locks). Clicking
 * an event flips the twin into security mode and highlights where it happened, events on a map
 * beat events in a list.
 */
export function EventTimeline() {
  const events = useTwinStore((state) => state.events);
  const rooms = useTwinStore((state) => state.rooms);
  const entityStates = useTwinStore((state) => state.entityStates);
  const setViewMode = useTwinStore((state) => state.setViewMode);
  const setHighlightedEntityId = useTwinStore((state) => state.setHighlightedEntityId);

  function locate(entityId: string) {
    setViewMode('security');
    setHighlightedEntityId(entityId);
  }

  function roomName(roomId: string | null): string {
    return rooms.find((room) => room.id === roomId)?.name ?? 'unplaced';
  }

  if (events.length === 0) {
    return (
      <p className="hint">No events yet. Device changes (motion, doors, locks) show up here.</p>
    );
  }

  return (
    <ul className="event-list">
      {events.map((event) => (
        <li key={event.id}>
          <button className="event" onClick={() => locate(event.entityId)}>
            <span className="event-name">
              {entityLabel(event.entityId, entityStates[event.entityId])}
            </span>
            <span className="event-detail">
              {event.from} → {event.to} · {roomName(event.roomId)}
            </span>
            <span className="event-time">{formatTime(event.at)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function formatTime(epochMs: number): string {
  const date = new Date(epochMs);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

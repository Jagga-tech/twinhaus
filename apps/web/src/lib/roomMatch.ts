import type { Room } from '../store/types.js';

/**
 * Resolve a spoken room name to a real room, so the agent understands "the lounge" for "Living
 * Room" or "kitchen" for "Kitchen / Diner". Tries, in order: exact (case-insensitive), one name
 * containing the other, then best token overlap. Returns null when nothing plausibly matches, the
 * caller then lists the known rooms rather than guessing wrong.
 */
export function matchRoom(rooms: Room[], query: string): Room | null {
  const q = normalize(query);
  if (!q) return null;

  const exact = rooms.find((room) => normalize(room.name) === q);
  if (exact) return exact;

  const contains = rooms.find((room) => {
    const name = normalize(room.name);
    return name.includes(q) || q.includes(name);
  });
  if (contains) return contains;

  const qTokens = new Set(q.split(' ').filter(Boolean));
  let best: Room | null = null;
  let bestScore = 0;
  for (const room of rooms) {
    const tokens = normalize(room.name).split(' ').filter(Boolean);
    const overlap = tokens.filter((token) => qTokens.has(token)).length;
    if (overlap > bestScore) {
      bestScore = overlap;
      best = room;
    }
  }
  return bestScore > 0 ? best : null;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

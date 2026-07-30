import { describe, expect, it } from 'vitest';
import type { Room } from '../store/types.js';
import { matchRoom } from './roomMatch.js';

const room = (id: string, name: string): Room => ({ id, name, polygon: [], height: 2.4 });

const rooms: Room[] = [
  room('r1', 'Living Room'),
  room('r2', 'Kitchen / Diner'),
  room('r3', 'Main Bedroom'),
];

describe('matchRoom', () => {
  it('matches case-insensitively and exactly', () => {
    expect(matchRoom(rooms, 'living room')?.id).toBe('r1');
    expect(matchRoom(rooms, 'MAIN BEDROOM')?.id).toBe('r3');
  });

  it('matches when the query is contained in the room name', () => {
    expect(matchRoom(rooms, 'kitchen')?.id).toBe('r2');
    expect(matchRoom(rooms, 'bedroom')?.id).toBe('r3');
  });

  it('matches on token overlap for partial phrasings', () => {
    expect(matchRoom(rooms, 'the living')?.id).toBe('r1');
    expect(matchRoom(rooms, 'diner')?.id).toBe('r2');
  });

  it('returns null when nothing plausibly matches', () => {
    expect(matchRoom(rooms, 'garage')).toBeNull();
    expect(matchRoom(rooms, '')).toBeNull();
  });
});

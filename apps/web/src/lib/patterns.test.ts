import { describe, expect, it } from 'vitest';
import { hourLabel, learnRoutines, timeParts, type Observation } from './patterns.js';

function obs(key: string, hour: number, day: string, data?: Record<string, unknown>): Observation {
  return { key, hour, day, data };
}

describe('learnRoutines', () => {
  it('ignores actions that do not recur on enough distinct days', () => {
    const history = [
      obs('light.lounge|turn_on', 21, '2026-08-01'),
      obs('light.lounge|turn_on', 21, '2026-08-02'),
    ];
    expect(learnRoutines(history)).toEqual([]);
  });

  it('learns a routine once an action recurs on three days at the same hour', () => {
    const history = [
      obs('light.lounge|turn_on', 21, '2026-08-01', { brightness_pct: 40 }),
      obs('light.lounge|turn_on', 21, '2026-08-02', { brightness_pct: 40 }),
      obs('light.lounge|turn_on', 21, '2026-08-03', { brightness_pct: 40 }),
    ];
    const routines = learnRoutines(history);
    expect(routines).toHaveLength(1);
    expect(routines[0].hour).toBe(21);
    expect(routines[0].observedDays).toBe(3);
    expect(routines[0].title).toContain('9pm');
    expect(routines[0].calls[0]).toEqual({
      domain: 'light',
      service: 'turn_on',
      target: { entity_id: 'light.lounge' },
      serviceData: { brightness_pct: 40 },
    });
  });

  it('counts distinct days only, so repeats on one day do not qualify', () => {
    const history = [
      obs('light.lounge|turn_on', 21, '2026-08-01'),
      obs('light.lounge|turn_on', 21, '2026-08-01'),
      obs('light.lounge|turn_on', 21, '2026-08-01'),
    ];
    expect(learnRoutines(history)).toEqual([]);
  });

  it('bundles actions that share an hour into one routine, most confident first', () => {
    const days = ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04'];
    const history = [
      ...days.map((d) => obs('light.lounge|turn_on', 21, d)),
      ...days.slice(0, 3).map((d) => obs('cover.living|close_cover', 21, d)),
      ...days.map((d) => obs('climate.hall|set_temperature', 7, d, { temperature: 21 })),
    ];
    const routines = learnRoutines(history);
    expect(routines).toHaveLength(2);
    // 7am climate seen on 4 days ties with 9pm lights on 4 days; both lead over the 3-day cover.
    const evening = routines.find((r) => r.hour === 21);
    expect(evening?.calls).toHaveLength(2);
    expect(evening?.calls.map((c) => c.service).sort()).toEqual(['close_cover', 'turn_on']);
    const morning = routines.find((r) => r.hour === 7);
    expect(morning?.title).toContain('Morning');
    expect(morning?.title).toContain('7am');
  });
});

describe('hourLabel', () => {
  it('names the edges of the clock and reads 12-hour otherwise', () => {
    expect(hourLabel(0)).toBe('midnight');
    expect(hourLabel(12)).toBe('noon');
    expect(hourLabel(9)).toBe('9am');
    expect(hourLabel(21)).toBe('9pm');
  });
});

describe('timeParts', () => {
  it('returns null for an unparseable timestamp', () => {
    expect(timeParts('not a date')).toBeNull();
    expect(timeParts('')).toBeNull();
  });
});

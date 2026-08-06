import { entityDomain, type CallServiceOptions, type HaEntityState } from '@twinhaus/ha-bridge';
import { captureEntry } from './scenes.js';

/**
 * Habit learning for the central brain. The brain not only reacts to the home's rulebook, it also
 * watches how the home is actually used and spots the rhythms in it, when you dim the lounge in the
 * evening, when you nudge the heating up in the morning. Recurring actions at a consistent hour
 * become suggested routines you can save with one tap.
 *
 * The logic here is pure and deterministic so it is fully testable: it takes a list of past
 * observations and returns the routines it can see in them. Recording those observations (reading
 * the wall clock) is the store's job.
 */

/** One recorded controllable action, bucketed by hour of day and the calendar day it happened. */
export interface Observation {
  /** Stable action key, `entityId|service`, e.g. `light.lounge|turn_on`. */
  key: string;
  /** Hour of day, 0 to 23, the action happened at. */
  hour: number;
  /** Calendar day (`YYYY-MM-DD`) it happened on, used to count how many distinct days it recurs. */
  day: string;
  /** Optional service data to reproduce it, e.g. a brightness or temperature. */
  data?: Record<string, unknown>;
}

/** A routine the brain has learned: the actions that recur together around one hour. */
export interface RoutineSuggestion {
  id: string;
  /** The hour of day, 0 to 23, the routine tends to happen at. */
  hour: number;
  /** A human label, e.g. `Evening routine, around 9pm`. */
  title: string;
  /** The calls that reproduce the routine, ready to run or save as a scene. */
  calls: CallServiceOptions[];
  /** How many distinct days the strongest action in the routine was seen, its confidence. */
  observedDays: number;
}

/** Default: an action must recur on at least this many distinct days before it is a routine. */
const MIN_DAYS = 3;

/**
 * Turn a history of observations into the routines hiding in it. Actions are grouped by hour and
 * key; any that recur on at least `minDays` distinct days qualify, and the qualifying actions that
 * share an hour are bundled into one routine. Most-confident routines come first.
 */
export function learnRoutines(
  observations: Observation[],
  minDays = MIN_DAYS,
): RoutineSuggestion[] {
  const groups = new Map<
    string,
    { key: string; hour: number; days: Set<string>; data?: Record<string, unknown> }
  >();
  for (const obs of observations) {
    const groupKey = `${obs.hour}::${obs.key}`;
    const group = groups.get(groupKey) ?? { key: obs.key, hour: obs.hour, days: new Set<string>() };
    group.days.add(obs.day);
    if (obs.data) group.data = obs.data;
    groups.set(groupKey, group);
  }

  const qualifying = [...groups.values()].filter((group) => group.days.size >= minDays);

  const byHour = new Map<number, typeof qualifying>();
  for (const group of qualifying) {
    const bucket = byHour.get(group.hour) ?? [];
    bucket.push(group);
    byHour.set(group.hour, bucket);
  }

  const suggestions: RoutineSuggestion[] = [];
  for (const [hour, actions] of byHour) {
    suggestions.push({
      id: `routine-${hour}`,
      hour,
      title: `${partOfDay(hour)} routine, around ${hourLabel(hour)}`,
      calls: actions.map((action) => toCall(action.key, action.data)),
      observedDays: Math.max(...actions.map((action) => action.days.size)),
    });
  }

  return suggestions.sort((a, b) => b.observedDays - a.observedDays);
}

/**
 * Reduce a live device state to one observation, or null if it is not a controllable action or has
 * no usable timestamp. Reuses the same capture the scenes feature uses, so a learned routine always
 * replays exactly the way a saved scene would.
 */
export function observationFrom(state: HaEntityState): Observation | null {
  const entry = captureEntry(state);
  if (!entry) return null;
  const parts = timeParts(state.last_changed);
  if (!parts) return null;
  return {
    key: `${entry.entityId}|${entry.service}`,
    hour: parts.hour,
    day: parts.day,
    data: entry.data,
  };
}

/** Split an ISO timestamp into its local hour and calendar day, or null if it cannot be parsed. */
export function timeParts(iso: string): { hour: number; day: string } | null {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const date = new Date(ms);
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return { hour: date.getHours(), day };
}

function toCall(key: string, data?: Record<string, unknown>): CallServiceOptions {
  const [entityId, service] = key.split('|');
  return {
    domain: entityDomain(entityId),
    service,
    target: { entity_id: entityId },
    serviceData: data,
  };
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** A friendly clock label for an hour, e.g. 0 is midnight, 12 is noon, 21 is 9pm. */
export function hourLabel(hour: number): string {
  if (hour === 0) return 'midnight';
  if (hour === 12) return 'noon';
  const period = hour < 12 ? 'am' : 'pm';
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}${period}`;
}

function partOfDay(hour: number): string {
  if (hour < 5) return 'Night';
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  if (hour < 22) return 'Evening';
  return 'Night';
}

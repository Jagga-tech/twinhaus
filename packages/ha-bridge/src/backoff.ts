/** Tuning for {@link backoffDelay}. Defaults give 1s, 2s, 4s … capped at 30s. */
export interface BackoffOptions {
  /** Delay for the first retry, in ms. */
  baseMs?: number;
  /** Upper bound on any single delay, in ms. */
  maxMs?: number;
  /** Fraction of jitter (0 to 1) added to spread out reconnecting clients. */
  jitter?: number;
}

const DEFAULTS: Required<BackoffOptions> = { baseMs: 1000, maxMs: 30000, jitter: 0.2 };

/**
 * Exponential backoff with jitter for reconnect scheduling. `attempt` is 0-based (0 is the first
 * retry). The delay doubles each attempt up to `maxMs`, then a random jitter fraction is added so a
 * fleet of clients reconnecting after the same outage don't stampede in lockstep.
 *
 * `random` is injectable so tests get a deterministic schedule.
 */
export function backoffDelay(
  attempt: number,
  options: BackoffOptions = {},
  random: () => number = Math.random,
): number {
  const { baseMs, maxMs, jitter } = { ...DEFAULTS, ...options };
  const exponential = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt));
  return Math.round(exponential * (1 + jitter * random()));
}

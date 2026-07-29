/**
 * Verify-after-act: after the agent calls a control service, confirm the device actually reached
 * the intended state instead of assuming success, and retry transient failures. This is what lets
 * the agent say "couldn't confirm the door locked" rather than a confident lie — the last gap in
 * "never a serious issue while operating".
 */

type Sleep = (ms: number) => Promise<void>;

const realSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The entity state a `domain.service` call should produce, or null when there's no single expected
 * value to check (e.g. `toggle`, `set_temperature`). Only unambiguous on/off/lock/cover transitions
 * are verified; anything else runs without a post-check.
 */
export function expectedStateFor(domain: string, service: string): string | null {
  if (service === 'turn_on') return 'on';
  if (service === 'turn_off') return 'off';
  if (domain === 'lock') {
    if (service === 'lock') return 'locked';
    if (service === 'unlock') return 'unlocked';
  }
  if (domain === 'cover') {
    if (service === 'open_cover') return 'open';
    if (service === 'close_cover') return 'closed';
  }
  return null;
}

/**
 * A transient failure is worth retrying (connection dropped, timing out); a rejection Home
 * Assistant returned on purpose (bad service, entity not found) is not — retrying just repeats it.
 */
export function isTransientError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /not connected|closed|timeout|timed out|network|reconnect|unreachable/i.test(message);
}

/** Run `fn`, retrying only transient failures with exponential backoff. */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { retries?: number; sleep?: Sleep; delayMs?: (attempt: number) => number } = {},
): Promise<T> {
  const retries = options.retries ?? 2;
  const sleep = options.sleep ?? realSleep;
  const delayMs = options.delayMs ?? ((attempt) => 300 * 2 ** attempt);

  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= retries || !isTransientError(error)) throw error;
      await sleep(delayMs(attempt));
      attempt += 1;
    }
  }
}

/**
 * Poll `read` until it returns the expected state or the attempts run out. State flows in
 * asynchronously over the WebSocket after a service call, so a short poll gives it time to land.
 */
export async function confirmState(
  read: () => string | undefined,
  expected: string,
  options: { attempts?: number; intervalMs?: number; sleep?: Sleep } = {},
): Promise<boolean> {
  const attempts = options.attempts ?? 6;
  const intervalMs = options.intervalMs ?? 400;
  const sleep = options.sleep ?? realSleep;

  for (let i = 0; i < attempts; i += 1) {
    if (read() === expected) return true;
    await sleep(intervalMs);
  }
  return read() === expected;
}

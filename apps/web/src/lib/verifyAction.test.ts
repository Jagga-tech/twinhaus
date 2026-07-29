import { describe, expect, it, vi } from 'vitest';
import { confirmState, expectedStateFor, isTransientError, withRetry } from './verifyAction.js';

const noSleep = () => Promise.resolve();

describe('expectedStateFor', () => {
  it('maps unambiguous transitions to a target state', () => {
    expect(expectedStateFor('light', 'turn_on')).toBe('on');
    expect(expectedStateFor('switch', 'turn_off')).toBe('off');
    expect(expectedStateFor('lock', 'lock')).toBe('locked');
    expect(expectedStateFor('lock', 'unlock')).toBe('unlocked');
    expect(expectedStateFor('cover', 'open_cover')).toBe('open');
    expect(expectedStateFor('cover', 'close_cover')).toBe('closed');
  });

  it('returns null when there is no single expected value to check', () => {
    expect(expectedStateFor('light', 'toggle')).toBeNull();
    expect(expectedStateFor('climate', 'set_temperature')).toBeNull();
  });
});

describe('isTransientError', () => {
  it('flags connection-level failures as transient', () => {
    expect(isTransientError(new Error('Not connected to Home Assistant'))).toBe(true);
    expect(isTransientError(new Error('Connection to Home Assistant closed'))).toBe(true);
  });

  it('does not flag deliberate Home Assistant rejections', () => {
    expect(isTransientError(new Error('Home Assistant command failed'))).toBe(false);
  });
});

describe('withRetry', () => {
  it('retries a transient failure then succeeds', async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls += 1;
        if (calls < 2) throw new Error('Not connected');
        return 'ok';
      },
      { sleep: noSleep },
    );
    expect(result).toBe('ok');
    expect(calls).toBe(2);
  });

  it('does not retry a non-transient failure', async () => {
    const fn = vi.fn(async () => {
      throw new Error('Home Assistant command failed');
    });
    await expect(withRetry(fn, { sleep: noSleep })).rejects.toThrow('command failed');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('gives up after the retry budget', async () => {
    const fn = vi.fn(async () => {
      throw new Error('timeout');
    });
    await expect(withRetry(fn, { retries: 2, sleep: noSleep })).rejects.toThrow('timeout');
    expect(fn).toHaveBeenCalledTimes(3); // initial + 2 retries
  });
});

describe('confirmState', () => {
  it('resolves true once the state reaches the expected value', async () => {
    let current = 'unlocked';
    const read = () => current;
    // Flip to the target after the first poll.
    const sleep = () => {
      current = 'locked';
      return Promise.resolve();
    };
    expect(await confirmState(read, 'locked', { sleep })).toBe(true);
  });

  it('resolves false when the state never reaches the expected value', async () => {
    expect(await confirmState(() => 'unlocked', 'locked', { attempts: 3, sleep: noSleep })).toBe(
      false,
    );
  });

  it('returns true immediately if already in the expected state', async () => {
    const sleep = vi.fn(noSleep);
    expect(await confirmState(() => 'on', 'on', { sleep })).toBe(true);
    expect(sleep).not.toHaveBeenCalled();
  });
});

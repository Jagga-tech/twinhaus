import { describe, expect, it } from 'vitest';
import { backoffDelay } from './backoff.js';

const noJitter = { jitter: 0 };
const zero = () => 0;

describe('backoffDelay', () => {
  it('doubles the delay each attempt from the base', () => {
    expect(backoffDelay(0, { baseMs: 1000, ...noJitter }, zero)).toBe(1000);
    expect(backoffDelay(1, { baseMs: 1000, ...noJitter }, zero)).toBe(2000);
    expect(backoffDelay(2, { baseMs: 1000, ...noJitter }, zero)).toBe(4000);
    expect(backoffDelay(3, { baseMs: 1000, ...noJitter }, zero)).toBe(8000);
  });

  it('caps the delay at maxMs', () => {
    expect(backoffDelay(20, { baseMs: 1000, maxMs: 30000, ...noJitter }, zero)).toBe(30000);
  });

  it('adds up to the jitter fraction', () => {
    expect(backoffDelay(0, { baseMs: 1000, jitter: 0.5 }, () => 1)).toBe(1500);
    expect(backoffDelay(0, { baseMs: 1000, jitter: 0.5 }, () => 0)).toBe(1000);
  });

  it('never goes below the base for attempt 0', () => {
    expect(backoffDelay(-5, { baseMs: 1000, ...noJitter }, zero)).toBe(1000);
  });
});

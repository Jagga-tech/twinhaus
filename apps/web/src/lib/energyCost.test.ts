import { describe, expect, it } from 'vitest';
import { energyCost, formatUsd } from './energyCost.js';

describe('energyCost', () => {
  it('converts watts and a rate into hourly, daily, and monthly cost', () => {
    const cost = energyCost(1000, 0.3); // 1 kW at 30c/kWh
    expect(cost.perHourUsd).toBeCloseTo(0.3, 5);
    expect(cost.perDayUsd).toBeCloseTo(7.2, 5);
    expect(cost.perMonthUsd).toBeCloseTo(216, 5);
  });

  it('clamps negatives to zero', () => {
    expect(energyCost(-50, 0.3).perHourUsd).toBe(0);
    expect(energyCost(100, -1).perHourUsd).toBe(0);
  });
});

describe('formatUsd', () => {
  it('shows cents under a dollar and dollars above', () => {
    expect(formatUsd(0.3)).toBe('30c');
    expect(formatUsd(7.2)).toBe('$7.20');
  });
});

import { describe, expect, it } from 'vitest';
import { entityDomain } from './types.js';

describe('entityDomain', () => {
  it('extracts the domain prefix', () => {
    expect(entityDomain('light.living_room')).toBe('light');
    expect(entityDomain('binary_sensor.front_door')).toBe('binary_sensor');
    expect(entityDomain('lock.back_door')).toBe('lock');
  });

  it('handles entity ids with extra dots in the object id', () => {
    expect(entityDomain('sensor.kitchen.temperature')).toBe('sensor');
  });
});

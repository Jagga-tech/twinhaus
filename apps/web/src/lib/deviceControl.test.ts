import { describe, expect, it } from 'vitest';
import type { HaEntityState } from '@twinhaus/ha-bridge';
import { quickControls } from './deviceControl.js';

function state(
  entity_id: string,
  s: string,
  attributes: HaEntityState['attributes'] = {},
): HaEntityState {
  return { entity_id, state: s, attributes, last_changed: '', last_updated: '' };
}

describe('quickControls', () => {
  it('offers on/off + brightness for a light and marks the active one', () => {
    const controls = quickControls(state('light.x', 'on'));
    const labels = controls.map((c) => c.label);
    expect(labels).toEqual(['On', 'Off', '30%', '100%']);
    expect(controls.find((c) => c.label === 'On')?.active).toBe(true);
    expect(controls[2].call.serviceData).toEqual({ brightness_pct: 30 });
  });

  it('offers lock/unlock for a lock', () => {
    const controls = quickControls(state('lock.door', 'locked'));
    expect(controls.map((c) => c.label)).toEqual(['Lock', 'Unlock']);
    expect(controls.find((c) => c.label === 'Lock')?.active).toBe(true);
  });

  it('steps climate temperature from the current setpoint', () => {
    const up = quickControls(state('climate.hall', 'heat', { temperature: 20 }))[1];
    expect(up.call.serviceData).toEqual({ temperature: 21 });
  });

  it('returns no controls for an unsupported domain', () => {
    expect(quickControls(state('sensor.temp', '21'))).toEqual([]);
  });
});

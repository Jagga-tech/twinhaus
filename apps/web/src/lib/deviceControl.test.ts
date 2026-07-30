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

  it('steps climate temperature and exposes hvac modes, marking the current one', () => {
    const controls = quickControls(state('climate.hall', 'heat', { temperature: 20 }));
    expect(controls[1].call.serviceData).toEqual({ temperature: 21 });
    expect(controls.map((c) => c.label)).toEqual(['-1°', '+1°', 'Heat', 'Cool', 'Off']);
    expect(controls.find((c) => c.label === 'Heat')?.active).toBe(true);
  });

  it('offers speed steps for a fan and reflects the live percentage', () => {
    const controls = quickControls(state('fan.office', 'on', { percentage: 100 }));
    expect(controls.map((c) => c.label)).toEqual(['On', 'Off', 'Low', 'High']);
    expect(controls.find((c) => c.label === 'High')?.active).toBe(true);
    expect(controls.find((c) => c.label === 'Low')?.call.serviceData).toEqual({ percentage: 33 });
  });

  it('offers transport + volume for a media player and toggles play/pause by state', () => {
    const playing = quickControls(state('media_player.tv', 'playing'));
    expect(playing[0].label).toBe('Pause');
    expect(playing[0].active).toBe(true);
    expect(quickControls(state('media_player.tv', 'idle'))[0].label).toBe('Play');
    expect(playing.map((c) => c.label)).toEqual(['Pause', '⏮', '⏭', 'Vol -', 'Vol +']);
  });

  it('offers clean/dock for a vacuum', () => {
    const controls = quickControls(state('vacuum.rock', 'cleaning'));
    expect(controls.map((c) => c.label)).toEqual(['Clean', 'Pause', 'Dock']);
    expect(controls.find((c) => c.label === 'Clean')?.active).toBe(true);
  });

  it('offers arm/disarm for an alarm panel', () => {
    const controls = quickControls(state('alarm_control_panel.house', 'armed_away'));
    expect(controls.map((c) => c.label)).toEqual(['Home', 'Away', 'Disarm']);
    expect(controls.find((c) => c.label === 'Away')?.active).toBe(true);
  });

  it('returns no controls for an unsupported domain', () => {
    expect(quickControls(state('sensor.temp', '21'))).toEqual([]);
  });
});

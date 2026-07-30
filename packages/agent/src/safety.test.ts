import { describe, expect, it } from 'vitest';
import { assessAction, toControlAction, type ControlAction } from './safety.js';

function action(domain: string, service: string, entityId = 'x.y'): ControlAction {
  return { domain, service, entityId };
}

describe('assessAction', () => {
  it('treats routine light/switch-on actions as safe', () => {
    expect(assessAction(action('light', 'turn_on')).risk).toBe('safe');
    expect(assessAction(action('scene', 'turn_on')).risk).toBe('safe');
    expect(assessAction(action('switch', 'turn_on')).requiresConfirmation).toBe(false);
  });

  it('flags unlocking, disarming, and opening as critical', () => {
    expect(assessAction(action('lock', 'unlock')).risk).toBe('critical');
    expect(assessAction(action('alarm_control_panel', 'alarm_disarm')).risk).toBe('critical');
    expect(assessAction(action('cover', 'open_cover')).risk).toBe('critical');
    for (const verdict of [
      assessAction(action('lock', 'unlock')),
      assessAction(action('alarm_control_panel', 'alarm_disarm')),
      assessAction(action('cover', 'open_cover')),
    ]) {
      expect(verdict.requiresConfirmation).toBe(true);
    }
  });

  it('does not flag locking or closing, the safe direction', () => {
    expect(assessAction(action('lock', 'lock')).risk).toBe('safe');
    expect(assessAction(action('cover', 'close_cover')).risk).toBe('safe');
  });

  it('treats turning off heating as critical', () => {
    expect(assessAction(action('climate', 'turn_off')).risk).toBe('critical');
    expect(assessAction(action('climate', 'set_hvac_mode')).requiresConfirmation).toBe(true);
  });

  it('treats whole-home and load-bearing actions as sensitive', () => {
    expect(assessAction(action('homeassistant', 'turn_off')).risk).toBe('sensitive');
    expect(assessAction(action('switch', 'turn_off')).risk).toBe('sensitive');
    expect(assessAction(action('vacuum', 'start')).risk).toBe('sensitive');
  });
});

describe('toControlAction', () => {
  it('parses a well-formed call_service input', () => {
    const parsed = toControlAction({
      domain: 'lock',
      service: 'unlock',
      entity_id: 'lock.front',
      data: { code: '1' },
    });
    expect(parsed).toEqual({
      domain: 'lock',
      service: 'unlock',
      entityId: 'lock.front',
      data: { code: '1' },
    });
  });

  it('returns null when the domain or service is missing', () => {
    expect(toControlAction({ service: 'turn_on' })).toBeNull();
    expect(toControlAction({ domain: 'light' })).toBeNull();
  });
});

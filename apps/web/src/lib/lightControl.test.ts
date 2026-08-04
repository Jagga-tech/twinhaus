import { describe, expect, it } from 'vitest';
import { setBrightnessCall, setColorCall, LIGHT_SWATCHES } from './lightControl.js';

describe('lightControl', () => {
  it('builds an rgb_color turn_on call', () => {
    expect(setColorCall('light.x', [255, 0, 128])).toEqual({
      domain: 'light',
      service: 'turn_on',
      target: { entity_id: 'light.x' },
      serviceData: { rgb_color: [255, 0, 128] },
    });
  });

  it('sets brightness as a percentage', () => {
    expect(setBrightnessCall('light.x', 60).serviceData).toEqual({ brightness_pct: 60 });
  });

  it('turns the light off at zero brightness', () => {
    const call = setBrightnessCall('light.x', 0);
    expect(call.service).toBe('turn_off');
    expect(call.serviceData).toBeUndefined();
  });

  it('clamps out-of-range brightness', () => {
    expect(setBrightnessCall('light.x', 150).serviceData).toEqual({ brightness_pct: 100 });
  });

  it('ships a usable palette', () => {
    expect(LIGHT_SWATCHES.length).toBeGreaterThan(3);
    expect(LIGHT_SWATCHES[0].rgb).toHaveLength(3);
  });
});

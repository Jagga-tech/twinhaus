import type { CallServiceOptions } from '@twinhaus/ha-bridge';

/** A named colour a light can be set to, with the RGB the service call sends. */
export interface ColorSwatch {
  name: string;
  rgb: [number, number, number];
  /** CSS colour for the UI swatch. */
  css: string;
}

/** A small, useful palette for one-tap light colours in the inspector. */
export const LIGHT_SWATCHES: ColorSwatch[] = [
  { name: 'Warm', rgb: [255, 197, 143], css: '#ffc58f' },
  { name: 'Daylight', rgb: [255, 244, 229], css: '#fff4e5' },
  { name: 'Cool', rgb: [201, 226, 255], css: '#c9e2ff' },
  { name: 'Red', rgb: [244, 67, 54], css: '#f44336' },
  { name: 'Green', rgb: [76, 175, 80], css: '#4caf50' },
  { name: 'Blue', rgb: [33, 150, 243], css: '#2196f3' },
  { name: 'Purple', rgb: [156, 39, 176], css: '#9c27b0' },
];

/** Build the service call to set a light to a colour. */
export function setColorCall(entityId: string, rgb: [number, number, number]): CallServiceOptions {
  return {
    domain: 'light',
    service: 'turn_on',
    target: { entity_id: entityId },
    serviceData: { rgb_color: rgb },
  };
}

/** Build the service call to set a light's brightness as a percentage (0 turns it off). */
export function setBrightnessCall(entityId: string, pct: number): CallServiceOptions {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  if (clamped === 0) {
    return { domain: 'light', service: 'turn_off', target: { entity_id: entityId } };
  }
  return {
    domain: 'light',
    service: 'turn_on',
    target: { entity_id: entityId },
    serviceData: { brightness_pct: clamped },
  };
}

import type { DeviceCategory } from '../store/types.js';

export type PrimitiveShape = 'sphere' | 'box' | 'cylinder' | 'cone';

export interface DeviceModel {
  shape: PrimitiveShape;
  /** Geometry args passed to the corresponding drei/three geometry. */
  args: number[];
}

/**
 * A built-in low-poly model per device category, so the twin reads by type at a glance (a
 * camera looks like a camera, a thermostat like a dial). Phase 4's community model library
 * extends this — and any category can be overridden by importing a `.glb`.
 */
export const DEVICE_MODELS: Record<DeviceCategory, DeviceModel> = {
  light: { shape: 'sphere', args: [0.14, 20, 20] },
  switch: { shape: 'box', args: [0.18, 0.18, 0.06] },
  lock: { shape: 'box', args: [0.14, 0.2, 0.1] },
  climate: { shape: 'cylinder', args: [0.14, 0.14, 0.06, 20] },
  sensor: { shape: 'box', args: [0.14, 0.14, 0.14] },
  motion: { shape: 'cone', args: [0.14, 0.22, 18] },
  camera: { shape: 'cone', args: [0.13, 0.26, 4] },
  media: { shape: 'box', args: [0.26, 0.16, 0.08] },
  cover: { shape: 'box', args: [0.28, 0.2, 0.04] },
  other: { shape: 'sphere', args: [0.13, 16, 16] },
};

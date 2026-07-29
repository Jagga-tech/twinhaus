import type { Room, TwinModel } from '../store/types.js';

export interface HomeTemplate {
  id: string;
  name: string;
  description: string;
  rooms: Array<Pick<Room, 'name' | 'polygon' | 'height'>>;
}

/** Rectangular room helper — polygon corners in meters, clockwise from top-left. */
function rect(x: number, z: number, w: number, d: number, name: string, height = 2.6) {
  return {
    name,
    height,
    polygon: [
      { x, z },
      { x: x + w, z },
      { x: x + w, z: z + d },
      { x, z: z + d },
    ],
  };
}

/**
 * Built-in home templates so a new user can start from a realistic layout instead of a blank
 * canvas. Phase 4 community templates use the same {@link TwinModel} shape for sharing.
 */
export const HOME_TEMPLATES: HomeTemplate[] = [
  {
    id: 'studio',
    name: 'Studio apartment',
    description: 'One main room, a bathroom, and a kitchenette.',
    rooms: [
      rect(-4, -3, 6, 6, 'Main room'),
      rect(2, -3, 3, 3, 'Kitchen'),
      rect(2, 0, 3, 3, 'Bathroom'),
    ],
  },
  {
    id: 'two-bed',
    name: '2-bed apartment',
    description: 'Living/kitchen open plan with two bedrooms and a bath.',
    rooms: [
      rect(-6, -4, 6, 5, 'Living room'),
      rect(0, -4, 4, 5, 'Kitchen'),
      rect(-6, 1, 5, 4, 'Bedroom 1'),
      rect(-1, 1, 5, 4, 'Bedroom 2'),
      rect(4, -4, 3, 3, 'Bathroom'),
    ],
  },
];

/** Materialize a template into a {@link TwinModel} the store can import. */
export function templateToTwin(template: HomeTemplate): TwinModel {
  return {
    version: 1,
    rooms: template.rooms.map((room, index) => ({ id: `tpl_${template.id}_${index}`, ...room })),
    devices: [],
    virtualDevices: [],
  };
}

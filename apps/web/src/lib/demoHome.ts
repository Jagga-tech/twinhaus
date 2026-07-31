import type { Point2D, Room, TwinModel } from '../store/types.js';

/** Rectangular room, polygon corners in meters, clockwise from top-left. */
function rect(id: string, name: string, x: number, z: number, w: number, d: number): Room {
  return {
    id,
    name,
    height: 2.6,
    polygon: [
      { x, z },
      { x: x + w, z },
      { x: x + w, z: z + d },
      { x, z: z + d },
    ],
  };
}

function place(entityId: string, roomId: string, position: Point2D) {
  return { entityId, roomId, position };
}

/**
 * The seed twin that pairs with {@link DemoProvider}. Rooms plus device placements whose entity
 * ids match the demo backend's live devices, so selecting Demo mode gives a furnished, controllable
 * home with zero setup. Loaded into the store only when the twin is otherwise empty.
 */
export function demoHome(): TwinModel {
  const living = rect('demo_living', 'Living Room', -6, -4, 6, 5);
  const kitchen = rect('demo_kitchen', 'Kitchen', 0, -4, 4, 5);
  const bedroom = rect('demo_bedroom', 'Bedroom', -6, 1, 6, 4);
  const hall = rect('demo_hall', 'Hall', 0, 1, 4, 4);

  return {
    version: 1,
    rooms: [living, kitchen, bedroom, hall],
    devices: [
      place('light.demo_living_lamp', living.id, { x: -4, z: -2 }),
      place('switch.demo_tv_plug', living.id, { x: -2, z: -3 }),
      place('media_player.demo_tv', living.id, { x: -5, z: -1 }),
      place('climate.demo_thermostat', living.id, { x: -1, z: -1 }),
      place('sensor.demo_power', living.id, { x: -3, z: -3.5 }),
      place('light.demo_kitchen', kitchen.id, { x: 2, z: -2 }),
      place('light.demo_bedroom', bedroom.id, { x: -4, z: 3 }),
      place('fan.demo_bedroom', bedroom.id, { x: -2, z: 2 }),
      place('lock.demo_front', hall.id, { x: 2, z: 4.5 }),
      place('binary_sensor.demo_hall_motion', hall.id, { x: 1, z: 2 }),
    ],
    virtualDevices: [],
  };
}

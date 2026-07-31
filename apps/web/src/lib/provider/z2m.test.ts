import { describe, expect, it } from 'vitest';
import { parseDeviceList, serviceToZ2mSet, slug, z2mToEntityState, type Z2mDevice } from './z2m.js';

const lamp: Z2mDevice = {
  friendlyName: 'Living Lamp',
  entityId: 'light.living_lamp',
  domain: 'light',
};

describe('parseDeviceList', () => {
  it('maps z2m devices to domains and entity ids, skipping the coordinator', () => {
    const payload = JSON.stringify([
      { type: 'Coordinator' },
      { friendly_name: 'Living Lamp', definition: { exposes: [{ type: 'light' }] } },
      { friendly_name: 'Front Lock', definition: { exposes: [{ type: 'lock' }] } },
      { friendly_name: 'Hall Sensor', definition: { exposes: [{ type: 'numeric' }] } },
    ]);
    const devices = parseDeviceList(payload);
    expect(devices).toEqual([
      { friendlyName: 'Living Lamp', entityId: 'light.living_lamp', domain: 'light' },
      { friendlyName: 'Front Lock', entityId: 'lock.front_lock', domain: 'lock' },
      { friendlyName: 'Hall Sensor', entityId: 'sensor.hall_sensor', domain: 'sensor' },
    ]);
  });

  it('is defensive against bad payloads', () => {
    expect(parseDeviceList('not json')).toEqual([]);
    expect(parseDeviceList('{}')).toEqual([]);
  });
});

describe('slug', () => {
  it('normalizes friendly names', () => {
    expect(slug('Living Room Lamp')).toBe('living_room_lamp');
    expect(slug('Kitchen/Diner #2')).toBe('kitchen_diner_2');
  });
});

describe('z2mToEntityState', () => {
  it('maps a light payload to on/off with attributes', () => {
    const state = z2mToEntityState(lamp, JSON.stringify({ state: 'ON', brightness: 200 }));
    expect(state?.entity_id).toBe('light.living_lamp');
    expect(state?.state).toBe('on');
    expect(state?.attributes.brightness).toBe(200);
    expect(state?.attributes.friendly_name).toBe('Living Lamp');
  });

  it('maps a lock and a sensor', () => {
    const lock: Z2mDevice = { friendlyName: 'Front', entityId: 'lock.front', domain: 'lock' };
    expect(z2mToEntityState(lock, JSON.stringify({ state: 'LOCK' }))?.state).toBe('locked');
    const sensor: Z2mDevice = { friendlyName: 'Hall', entityId: 'sensor.hall', domain: 'sensor' };
    expect(z2mToEntityState(sensor, JSON.stringify({ temperature: 21.5 }))?.state).toBe('21.5');
  });

  it('returns null on malformed payloads', () => {
    expect(z2mToEntityState(lamp, 'nope')).toBeNull();
  });
});

describe('serviceToZ2mSet', () => {
  it('builds a /set publish for turn_on with brightness', () => {
    const cmd = serviceToZ2mSet(lamp, {
      domain: 'light',
      service: 'turn_on',
      serviceData: { brightness_pct: 50 },
    });
    expect(cmd?.topic).toBe('zigbee2mqtt/Living Lamp/set');
    expect(JSON.parse(cmd!.payload)).toEqual({ state: 'ON', brightness: 127 });
  });

  it('maps lock and cover verbs', () => {
    expect(
      JSON.parse(serviceToZ2mSet(lamp, { domain: 'lock', service: 'unlock' })!.payload),
    ).toEqual({ state: 'UNLOCK' });
    expect(
      JSON.parse(serviceToZ2mSet(lamp, { domain: 'cover', service: 'open_cover' })!.payload),
    ).toEqual({ state: 'OPEN' });
  });

  it('returns null for services it does not map', () => {
    expect(serviceToZ2mSet(lamp, { domain: 'light', service: 'effect' })).toBeNull();
  });
});

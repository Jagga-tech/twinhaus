import { describe, expect, it } from 'vitest';
import { MqttProvider } from './mqttProvider.js';
import type { MqttMessage, MqttTransport } from './mqttTransport.js';
import type { StateChangedEvent } from './types.js';
import { Z2M_DEVICES_TOPIC } from './z2m.js';

/** A fake broker: records publishes and lets a test push messages back to the provider. */
function fakeTransport(): MqttTransport & {
  publishes: Array<{ topic: string; payload: string }>;
  subscriptions: string[];
  push: (message: MqttMessage) => void;
} {
  let onMessage: (message: MqttMessage) => void = () => undefined;
  const publishes: Array<{ topic: string; payload: string }> = [];
  const subscriptions: string[] = [];
  return {
    publishes,
    subscriptions,
    connect: async () => undefined,
    subscribe: (topic) => subscriptions.push(topic),
    publish: (topic, payload) => publishes.push({ topic, payload }),
    onMessage: (listener) => {
      onMessage = listener;
    },
    onClose: () => undefined,
    end: () => undefined,
    push: (message) => onMessage(message),
  };
}

const DEVICE_LIST = JSON.stringify([
  { friendly_name: 'Living Lamp', definition: { exposes: [{ type: 'light' }] } },
  { friendly_name: 'Front Lock', definition: { exposes: [{ type: 'lock' }] } },
]);

describe('MqttProvider', () => {
  it('requires a broker URL', async () => {
    const provider = new MqttProvider(fakeTransport());
    await expect(provider.connect({})).rejects.toThrow(/broker/);
  });

  it('connects, subscribes, and reports connected', async () => {
    const transport = fakeTransport();
    const provider = new MqttProvider(transport);
    await provider.connect({ url: 'ws://broker:9001' });
    expect(provider.getStatus()).toBe('connected');
    expect(transport.subscriptions).toContain(Z2M_DEVICES_TOPIC);
  });

  it('ingests the device roster then surfaces device state', async () => {
    const transport = fakeTransport();
    const provider = new MqttProvider(transport);
    const events: StateChangedEvent[] = [];
    provider.onStateChanged((e) => events.push(e));
    await provider.connect({ url: 'ws://broker:9001' });

    transport.push({ topic: Z2M_DEVICES_TOPIC, payload: DEVICE_LIST });
    transport.push({ topic: 'zigbee2mqtt/Living Lamp', payload: JSON.stringify({ state: 'ON' }) });

    expect(events.find((e) => e.entity_id === 'light.living_lamp')?.new_state?.state).toBe('on');
    const states = await provider.getStates();
    expect(states).toHaveLength(1);
  });

  it('ignores availability and bridge sub-topics', async () => {
    const transport = fakeTransport();
    const provider = new MqttProvider(transport);
    const events: StateChangedEvent[] = [];
    provider.onStateChanged((e) => events.push(e));
    await provider.connect({ url: 'ws://broker:9001' });
    transport.push({ topic: Z2M_DEVICES_TOPIC, payload: DEVICE_LIST });

    transport.push({ topic: 'zigbee2mqtt/Living Lamp/availability', payload: 'online' });
    transport.push({ topic: 'zigbee2mqtt/bridge/state', payload: 'online' });
    expect(events).toHaveLength(0);
  });

  it('publishes a /set command for a control call', async () => {
    const transport = fakeTransport();
    const provider = new MqttProvider(transport);
    await provider.connect({ url: 'ws://broker:9001' });
    transport.push({ topic: Z2M_DEVICES_TOPIC, payload: DEVICE_LIST });

    await provider.callService({
      domain: 'lock',
      service: 'lock',
      target: { entity_id: 'lock.front_lock' },
    });
    expect(transport.publishes).toContainEqual({
      topic: 'zigbee2mqtt/Front Lock/set',
      payload: JSON.stringify({ state: 'LOCK' }),
    });
  });
});

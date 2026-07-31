import { describe, expect, it } from 'vitest';
import { MatterProvider } from './matterProvider.js';
import type { CompanionSocket } from './companionSocket.js';
import type { EntityState, StateChangedEvent } from './types.js';

/** A fake companion service: records outbound messages, lets a test push frames back. */
function fakeSocket(): CompanionSocket & { sent: unknown[]; push: (message: unknown) => void } {
  let onMessage: (message: unknown) => void = () => undefined;
  const sent: unknown[] = [];
  return {
    sent,
    connect: async () => undefined,
    send: (message) => sent.push(message),
    onMessage: (listener) => {
      onMessage = listener;
    },
    onClose: () => undefined,
    close: () => undefined,
    push: (message) => onMessage(message),
  };
}

const state = (entity_id: string, s: string): EntityState => ({
  entity_id,
  state: s,
  attributes: {},
  last_changed: '',
  last_updated: '',
});

describe('MatterProvider', () => {
  it('requires a companion service URL', async () => {
    const provider = new MatterProvider(fakeSocket());
    await expect(provider.connect({})).rejects.toThrow(/companion service/);
  });

  it('subscribes on connect and seeds state from a snapshot', async () => {
    const socket = fakeSocket();
    const provider = new MatterProvider(socket);
    await provider.connect({ url: 'ws://localhost:5580' });
    expect(socket.sent).toContainEqual({ type: 'subscribe' });
    expect(provider.getStatus()).toBe('connected');

    socket.push({ type: 'snapshot', states: [state('light.matter_a', 'on')] });
    expect((await provider.getStates())[0].entity_id).toBe('light.matter_a');
  });

  it('applies incremental events and emits state changes', async () => {
    const socket = fakeSocket();
    const provider = new MatterProvider(socket);
    const events: StateChangedEvent[] = [];
    provider.onStateChanged((e) => events.push(e));
    await provider.connect({ url: 'ws://localhost:5580' });

    socket.push({ type: 'event', state: state('lock.matter_front', 'unlocked') });
    expect(events[0]?.new_state?.state).toBe('unlocked');
  });

  it('sends a command frame for a control call', async () => {
    const socket = fakeSocket();
    const provider = new MatterProvider(socket);
    await provider.connect({ url: 'ws://localhost:5580' });
    await provider.callService({
      domain: 'light',
      service: 'turn_on',
      target: { entity_id: 'light.matter_a' },
      serviceData: { brightness_pct: 40 },
    });
    expect(socket.sent).toContainEqual({
      type: 'command',
      domain: 'light',
      service: 'turn_on',
      entity_id: 'light.matter_a',
      data: { brightness_pct: 40 },
    });
  });
});

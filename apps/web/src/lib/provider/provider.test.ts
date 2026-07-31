import { describe, expect, it, vi } from 'vitest';
import type { HaClient } from '@twinhaus/ha-bridge';
import { HomeAssistantProvider } from './haProvider.js';
import type { CallServiceOptions, DeviceProvider, EntityState } from './types.js';

/** A minimal in-memory backend, proving the interface is satisfiable without Home Assistant. */
function fakeProvider(): DeviceProvider & {
  fire: (e: EntityState) => void;
  calls: CallServiceOptions[];
} {
  const listeners = new Set<
    (e: { entity_id: string; new_state: EntityState | null; old_state: null }) => void
  >();
  const calls: CallServiceOptions[] = [];
  return {
    id: 'fake',
    label: 'Fake',
    standalone: true,
    summary: 'test backend',
    calls,
    connect: async () => undefined,
    disconnect: () => undefined,
    getStatus: () => 'connected',
    onStatusChange: () => () => undefined,
    onStateChanged: (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    onReconnected: () => () => undefined,
    getStates: async () => [],
    callService: async (options) => {
      calls.push(options);
    },
    fire: (state) =>
      listeners.forEach((cb) =>
        cb({ entity_id: state.entity_id, new_state: state, old_state: null }),
      ),
  };
}

describe('DeviceProvider contract', () => {
  it('a standalone backend needs no hub and routes control + state', async () => {
    const provider = fakeProvider();
    expect(provider.standalone).toBe(true);

    const seen: string[] = [];
    const off = provider.onStateChanged((e) => seen.push(e.entity_id));
    provider.fire({
      entity_id: 'light.x',
      state: 'on',
      attributes: {},
      last_changed: '',
      last_updated: '',
    });
    expect(seen).toEqual(['light.x']);

    await provider.callService({
      domain: 'light',
      service: 'turn_on',
      target: { entity_id: 'light.x' },
    });
    expect(provider.calls[0].service).toBe('turn_on');
    off();
  });
});

describe('HomeAssistantProvider', () => {
  it('delegates to the underlying HaClient and exposes a registry', async () => {
    const client = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      getStatus: vi.fn().mockReturnValue('connected'),
      onStatusChange: vi.fn().mockReturnValue(() => undefined),
      onStateChanged: vi.fn().mockReturnValue(() => undefined),
      onReconnected: vi.fn().mockReturnValue(() => undefined),
      getStates: vi.fn().mockResolvedValue([]),
      callService: vi.fn().mockResolvedValue(undefined),
      listFloors: vi.fn().mockResolvedValue([]),
      listAreas: vi.fn().mockResolvedValue([]),
      listDeviceRegistry: vi.fn().mockResolvedValue([]),
      listEntityRegistry: vi.fn().mockResolvedValue([]),
    } as unknown as HaClient;
    const provider = new HomeAssistantProvider(client);

    expect(provider.standalone).toBe(false);
    expect(provider.registry).toBeDefined();

    await provider.connect({ url: 'http://h:8123', token: 't' });
    expect(client.connect).toHaveBeenCalledWith({ url: 'http://h:8123', token: 't' });

    await provider.callService({
      domain: 'lock',
      service: 'lock',
      target: { entity_id: 'lock.a' },
    });
    expect(client.callService).toHaveBeenCalled();

    await provider.registry?.listAreas();
    expect(client.listAreas).toHaveBeenCalled();
  });

  it('rejects a connect with no URL or token before touching the client', async () => {
    const client = { connect: vi.fn() } as unknown as HaClient;
    const provider = new HomeAssistantProvider(client);
    await expect(provider.connect({})).rejects.toThrow(/URL/);
    expect(client.connect).not.toHaveBeenCalled();
  });
});

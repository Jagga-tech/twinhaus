import { beforeEach, describe, expect, it } from 'vitest';
import type { RawConfigFlow, RawConfigFlowStep } from '@twinhaus/ha-bridge';
import { ConfigFlowController, normalizeFlows, type DiscoveryTransport } from '@twinhaus/discovery';
import { useTwinStore } from '../store/twinStore.js';
import { syntheticEntityId } from './discoveryPlacement.js';

/**
 * End-to-end journey with a mocked HA transport: a discovered device appears in the tray, the
 * user adds it (the flow completes), placement is prompted, and the device lands in the twin, * the same store path a manually placed device takes, so it renders in 3D.
 */
function transport(steps: RawConfigFlowStep[]): DiscoveryTransport {
  let index = 0;
  return {
    async subscribeFlows() {
      return () => undefined;
    },
    async getFlow() {
      return steps[index++];
    },
    async stepFlow() {
      return steps[index++];
    },
    async abortFlow() {},
  };
}

const room = {
  id: 'r1',
  name: 'Hallway',
  polygon: [
    { x: 0, z: 0 },
    { x: 4, z: 0 },
    { x: 4, z: 4 },
    { x: 0, z: 4 },
  ],
  height: 2.6,
};

describe('discovery journey', () => {
  beforeEach(() => {
    useTwinStore.setState({
      rooms: [room],
      devices: [],
      discovered: [],
      pendingPlacement: null,
      connectionStatus: 'connected',
    });
  });

  it('device appears to add to flow completes to placement to visible in the twin', async () => {
    const store = useTwinStore.getState();

    const flows: RawConfigFlow[] = [
      { flow_id: 'flow_august', handler: 'august', context: { source: 'bluetooth' } },
    ];
    store.setDiscovered(normalizeFlows(flows));
    const discovered = useTwinStore.getState().discovered;
    expect(discovered).toHaveLength(1);
    const device = discovered[0];
    expect(device).toMatchObject({ brand: 'August', category: 'lock', source: 'bluetooth' });

    const controller = new ConfigFlowController(
      transport([
        {
          type: 'form',
          flow_id: 'flow_august',
          handler: 'august',
          data_schema: [{ name: 'pin', type: 'string', required: true }],
        },
        { type: 'create_entry', flow_id: 'flow_august', handler: 'august', title: 'Front Door' },
      ]),
    );

    const form = await controller.begin(device.id);
    expect(form.status).toBe('form');
    const done = await controller.submit({ pin: '1234' });
    expect(done.status).toBe('done');

    const entityId = syntheticEntityId(device);
    expect(entityId).toBe('lock.august');
    useTwinStore.getState().setPendingPlacement({ entityId, label: device.name });
    expect(useTwinStore.getState().pendingPlacement).not.toBeNull();

    const pending = useTwinStore.getState().pendingPlacement!;
    useTwinStore.getState().placeDevice(pending.entityId, room.id, { x: 2, z: 2 });
    useTwinStore.getState().setPendingPlacement(null);

    const devices = useTwinStore.getState().devices;
    expect(devices).toHaveLength(1);
    expect(devices[0]).toMatchObject({ entityId: 'lock.august', roomId: 'r1' });
    expect(useTwinStore.getState().pendingPlacement).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import type { RawConfigFlow, RawConfigFlowStep } from '@twinhaus/ha-bridge';
import { guessCategory, normalizeFlow, normalizeFlows } from './normalize.js';
import { ConfigFlowController, normalizeSchema } from './flowController.js';
import type { DiscoveryTransport } from './types.js';

function flow(handler: string, source: string, name?: string): RawConfigFlow {
  return {
    flow_id: `flow_${handler}`,
    handler,
    context: { source, title_placeholders: name ? { name } : undefined },
  };
}

describe('normalizeFlow', () => {
  it('maps a known integration to brand and category', () => {
    const device = normalizeFlow(flow('hue', 'zeroconf'));
    expect(device).toMatchObject({ integration: 'hue', brand: 'Philips Hue', category: 'light' });
  });

  it('maps discovery sources', () => {
    expect(normalizeFlow(flow('x', 'bluetooth')).source).toBe('bluetooth');
    expect(normalizeFlow(flow('x', 'dhcp')).source).toBe('dhcp');
    expect(normalizeFlow(flow('x', 'homekit')).source).toBe('zeroconf');
    expect(normalizeFlow(flow('x', 'mqtt')).source).toBe('other');
  });

  it('prefers the title placeholder for the name and title-cases unknown handlers', () => {
    expect(normalizeFlow(flow('hue', 'zeroconf', 'Living Room Bridge')).name).toBe(
      'Living Room Bridge',
    );
    expect(normalizeFlow(flow('my_gadget', 'ssdp')).brand).toBe('My Gadget');
  });
});

describe('normalizeFlows', () => {
  it('keeps only flows that came from a discovery source', () => {
    const raw: RawConfigFlow[] = [
      flow('hue', 'zeroconf'),
      { flow_id: 'user1', handler: 'manual', context: {} },
    ];
    const devices = normalizeFlows(raw);
    expect(devices).toHaveLength(1);
    expect(devices[0].integration).toBe('hue');
  });
});

describe('guessCategory', () => {
  it('guesses from the integration handler', () => {
    expect(guessCategory('august')).toBe('lock');
    expect(guessCategory('ring')).toBe('camera');
    expect(guessCategory('sonos')).toBe('media');
    expect(guessCategory('unknown')).toBe('other');
  });
});

describe('normalizeSchema', () => {
  it('classifies field types and treats secrets as password', () => {
    const fields = normalizeSchema([
      { name: 'host', type: 'string', required: true },
      { name: 'port', type: 'integer', optional: true },
      { name: 'api_key', type: 'string', required: true },
      { name: 'ssl', type: 'boolean' },
      {
        name: 'mode',
        options: [
          ['eco', 'Eco'],
          ['boost', 'Boost'],
        ],
      },
    ]);
    expect(fields.map((f) => `${f.name}:${f.type}`)).toEqual([
      'host:text',
      'port:number',
      'api_key:password',
      'ssl:boolean',
      'mode:select',
    ]);
    expect(fields[0].required).toBe(true);
    expect(fields[1].required).toBe(false);
    expect(fields[4].options).toEqual([
      { value: 'eco', label: 'Eco' },
      { value: 'boost', label: 'Boost' },
    ]);
  });
});

/** A scripted transport: begin() returns the queued steps in order as the flow advances. */
function scriptedTransport(steps: RawConfigFlowStep[]): DiscoveryTransport & { aborted: string[] } {
  let index = 0;
  const aborted: string[] = [];
  return {
    aborted,
    async subscribeFlows() {
      return () => undefined;
    },
    async getFlow() {
      return steps[index++];
    },
    async stepFlow() {
      return steps[index++];
    },
    async abortFlow(flowId) {
      aborted.push(flowId);
    },
  };
}

describe('ConfigFlowController', () => {
  it('drives a form to create_entry flow to done', async () => {
    const transport = scriptedTransport([
      {
        type: 'form',
        flow_id: 'f1',
        handler: 'august',
        step_id: 'pair',
        data_schema: [{ name: 'pin', type: 'string', required: true }],
      },
      { type: 'create_entry', flow_id: 'f1', handler: 'august', title: 'Front Door' },
    ]);
    const controller = new ConfigFlowController(transport);

    const first = await controller.begin('f1');
    expect(first.status).toBe('form');
    if (first.status === 'form') {
      expect(first.fields[0]).toMatchObject({ name: 'pin', type: 'password', required: true });
    }

    const done = await controller.submit({ pin: '1234' });
    expect(done).toEqual({ status: 'done', title: 'Front Door' });
  });

  it('reports an aborted flow', async () => {
    const transport = scriptedTransport([
      { type: 'abort', flow_id: 'f2', handler: 'x', reason: 'already_configured' },
    ]);
    const controller = new ConfigFlowController(transport);
    const state = await controller.begin('f2');
    expect(state).toEqual({ status: 'aborted', reason: 'already_configured' });
  });

  it('surfaces transport errors instead of throwing', async () => {
    const transport: DiscoveryTransport = {
      async subscribeFlows() {
        return () => undefined;
      },
      async getFlow() {
        throw new Error('HA offline');
      },
      async stepFlow() {
        throw new Error('unused');
      },
      async abortFlow() {},
    };
    const controller = new ConfigFlowController(transport);
    const state = await controller.begin('f3');
    expect(state).toEqual({ status: 'error', message: 'HA offline' });
  });

  it('aborts the in-progress flow on cancel', async () => {
    const transport = scriptedTransport([
      { type: 'form', flow_id: 'f4', handler: 'x', data_schema: [] },
    ]);
    const controller = new ConfigFlowController(transport);
    await controller.begin('f4');
    await controller.cancel();
    expect(transport.aborted).toEqual(['f4']);
  });
});

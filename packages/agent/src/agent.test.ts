import { describe, expect, it } from 'vitest';
import { Agent } from './agent.js';
import type { AssistantTurn, HomeContext, LlmProvider } from './index.js';

/** A provider that plays back a scripted sequence of turns, one per model step. */
function scriptedProvider(turns: AssistantTurn[]): LlmProvider {
  let step = 0;
  return {
    id: 'scripted',
    async complete() {
      return turns[Math.min(step++, turns.length - 1)];
    },
  };
}

function recordingContext(): { context: HomeContext; calls: string[] } {
  const calls: string[] = [];
  const context: HomeContext = {
    async describeHome() {
      calls.push('describe_home');
      return 'Living Room: light.living_room (on)';
    },
    async getRoomDevices(room) {
      calls.push(`get_room_devices:${room}`);
      return 'ok';
    },
    async listEntities() {
      calls.push('list_entities');
      return 'light.living_room';
    },
    async getEnergyByRoom() {
      calls.push('get_energy_by_room');
      return '0 W';
    },
    async listDiscoveredDevices() {
      calls.push('list_discovered_devices');
      return 'Hue Bridge';
    },
    async searchDeviceCatalog(query) {
      calls.push(`search_device_catalog:${query ?? ''}`);
      return 'Nuki Smart Lock 4.0';
    },
    async callService({ domain, service, entityId }) {
      calls.push(`call_service:${domain}.${service}:${entityId}`);
      return 'done';
    },
  };
  return { context, calls };
}

describe('Agent', () => {
  it('runs the tool loop: executes a tool call, then returns the final text', async () => {
    const { context, calls } = recordingContext();
    const provider = scriptedProvider([
      { text: '', toolCalls: [{ id: 't1', name: 'describe_home', input: {} }] },
      { text: 'The living room light is on.', toolCalls: [] },
    ]);

    const agent = new Agent({ provider, context });
    const reply = await agent.send('what is on in the living room?');

    expect(calls).toEqual(['describe_home']);
    expect(reply).toBe('The living room light is on.');
  });

  it('dispatches call_service tool calls to the context', async () => {
    const { context, calls } = recordingContext();
    const provider = scriptedProvider([
      {
        text: '',
        toolCalls: [
          {
            id: 't1',
            name: 'call_service',
            input: { domain: 'light', service: 'turn_off', entity_id: 'light.living_room' },
          },
        ],
      },
      { text: 'Turned it off.', toolCalls: [] },
    ]);

    const agent = new Agent({ provider, context });
    const reply = await agent.send('turn off the living room');

    expect(calls).toContain('call_service:light.turn_off:light.living_room');
    expect(reply).toBe('Turned it off.');
  });

  it('reports tool errors back into the loop without throwing', async () => {
    const context: HomeContext = {
      describeHome: async () => 'ok',
      getRoomDevices: async () => 'ok',
      listEntities: async () => 'ok',
      getEnergyByRoom: async () => 'ok',
      listDiscoveredDevices: async () => 'ok',
      searchDeviceCatalog: async () => 'ok',
      callService: async () => {
        throw new Error('HA offline');
      },
    };
    const events: string[] = [];
    const provider = scriptedProvider([
      {
        text: '',
        toolCalls: [
          {
            id: 't1',
            name: 'call_service',
            input: { domain: 'light', service: 'turn_on', entity_id: 'light.x' },
          },
        ],
      },
      { text: "Couldn't reach it.", toolCalls: [] },
    ]);

    const agent = new Agent({ provider, context });
    const reply = await agent.send('turn on', (event) => {
      if (event.type === 'tool_result') events.push(`${event.isError}:${event.content}`);
    });

    expect(events).toContain('true:HA offline');
    expect(reply).toBe("Couldn't reach it.");
  });

  it('stops at maxSteps to avoid an infinite tool loop', async () => {
    const { context } = recordingContext();
    // A provider that always asks for another tool call.
    const provider: LlmProvider = {
      id: 'loop',
      async complete() {
        return { text: 'still going', toolCalls: [{ id: 't', name: 'describe_home', input: {} }] };
      },
    };
    const agent = new Agent({ provider, context, maxSteps: 3 });
    const reply = await agent.send('go');
    expect(reply).toBe('still going');
  });
});

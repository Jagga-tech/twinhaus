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
    // Silent by design so existing call-order assertions stay clean; a dedicated test covers wiring.
    async homeSummary() {
      return '';
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
    async checkHome() {
      calls.push('check_home');
      return '[info] Nothing needs attention.';
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
      homeSummary: async () => '',
      getRoomDevices: async () => 'ok',
      listEntities: async () => 'ok',
      getEnergyByRoom: async () => 'ok',
      checkHome: async () => 'ok',
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

  it('injects the home snapshot as request context so the model can act without a lookup', async () => {
    const { context } = recordingContext();
    context.homeSummary = async () => 'Living Room: light.living_room=on';
    let seenContext: string | undefined;
    const provider: LlmProvider = {
      id: 'capture',
      async complete(request) {
        seenContext = request.context;
        return { text: 'done', toolCalls: [] };
      },
    };
    const agent = new Agent({ provider, context });
    await agent.send('hi');
    expect(seenContext).toContain('light.living_room=on');
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

describe('Agent safety loop', () => {
  function unlockProvider(): LlmProvider {
    return scriptedProvider([
      {
        text: '',
        toolCalls: [
          {
            id: 't1',
            name: 'call_service',
            input: { domain: 'lock', service: 'unlock', entity_id: 'lock.front' },
          },
        ],
      },
      { text: 'I need your OK to unlock the front door.', toolCalls: [] },
    ]);
  }

  it('never runs a guarded action when no approver is wired', async () => {
    const { context, calls } = recordingContext();
    const agent = new Agent({ provider: unlockProvider(), context });
    const events: string[] = [];

    await agent.send('unlock the front door', (event) => {
      if (event.type === 'action_blocked') events.push(event.reason);
    });

    expect(calls).not.toContain('call_service:lock.unlock:lock.front');
    expect(events).toContain('unlocks a lock');
  });

  it('runs a guarded action once the user approves it', async () => {
    const { context, calls } = recordingContext();
    const seen: string[] = [];
    const agent = new Agent({
      provider: unlockProvider(),
      context,
      confirmAction: async (action, verdict) => {
        seen.push(`${action.domain}.${action.service}:${verdict.risk}`);
        return true;
      },
    });

    await agent.send('unlock the front door');

    expect(seen).toContain('lock.unlock:critical');
    expect(calls).toContain('call_service:lock.unlock:lock.front');
  });

  it('trips the circuit breaker after consecutive tool errors', async () => {
    const context: HomeContext = {
      describeHome: async () => 'ok',
      homeSummary: async () => '',
      getRoomDevices: async () => 'ok',
      listEntities: async () => 'ok',
      getEnergyByRoom: async () => 'ok',
      checkHome: async () => 'ok',
      listDiscoveredDevices: async () => 'ok',
      searchDeviceCatalog: async () => 'ok',
      callService: async () => {
        throw new Error('HA offline');
      },
    };
    const provider: LlmProvider = {
      id: 'errloop',
      async complete() {
        return {
          text: 'retrying',
          toolCalls: [
            {
              id: 't',
              name: 'call_service',
              input: { domain: 'light', service: 'turn_on', entity_id: 'light.x' },
            },
          ],
        };
      },
    };
    let halted = '';
    const agent = new Agent({ provider, context, maxConsecutiveErrors: 2, maxSteps: 10 });
    await agent.send('turn on', (event) => {
      if (event.type === 'loop_halted') halted = event.reason;
    });
    expect(halted).toMatch(/errors in a row/);
  });

  it('caps the number of control actions per request', async () => {
    const { context, calls } = recordingContext();
    const provider: LlmProvider = {
      id: 'spam',
      async complete() {
        return {
          text: 'spamming',
          toolCalls: [
            {
              id: 't',
              name: 'call_service',
              input: { domain: 'light', service: 'turn_on', entity_id: 'light.x' },
            },
          ],
        };
      },
    };
    let halted = '';
    const agent = new Agent({ provider, context, maxActions: 3, maxSteps: 20 });
    await agent.send('go wild', (event) => {
      if (event.type === 'loop_halted') halted = event.reason;
    });
    expect(halted).toMatch(/action budget/);
    expect(calls.filter((c) => c.startsWith('call_service')).length).toBe(3);
  });
});

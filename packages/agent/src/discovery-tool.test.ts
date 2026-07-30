import { describe, expect, it } from 'vitest';
import { Agent } from './agent.js';
import { TOOL_DEFINITIONS } from './tools.js';
import type { AssistantTurn, HomeContext, LlmProvider } from './index.js';

function provider(turns: AssistantTurn[]): LlmProvider {
  let step = 0;
  return {
    id: 'scripted',
    async complete() {
      return turns[Math.min(step++, turns.length - 1)];
    },
  };
}

const NORMALIZED = 'Front Door Lock, August (via bluetooth)';
const CATALOG_RESULT = 'Nuki Smart Lock 4.0 (lock), ~$160, wifi/bluetooth, local setup';

function context(): HomeContext {
  return {
    describeHome: async () => 'ok',
    getRoomDevices: async () => 'ok',
    listEntities: async () => 'ok',
    getEnergyByRoom: async () => 'ok',
    listDiscoveredDevices: async () => NORMALIZED,
    searchDeviceCatalog: async () => CATALOG_RESULT,
    callService: async () => 'done',
  };
}

describe('list_discovered_devices tool', () => {
  it('returns normalized discovery results into the conversation', async () => {
    const seen: string[] = [];
    const agent = new Agent({
      provider: provider([
        { text: '', toolCalls: [{ id: 't1', name: 'list_discovered_devices', input: {} }] },
        { text: 'You have a new August lock.', toolCalls: [] },
      ]),
      context: context(),
    });

    const reply = await agent.send('anything new on my network?', (event) => {
      if (event.type === 'tool_result') seen.push(event.content);
    });

    expect(seen).toContain(NORMALIZED);
    expect(reply).toBe('You have a new August lock.');
  });

  it('exposes no tool that can start, step, or complete a config flow', () => {
    const names = TOOL_DEFINITIONS.map((tool) => tool.name);
    expect(names).toContain('list_discovered_devices');
    for (const name of names) {
      expect(name).not.toMatch(/flow|config_entr|add_device|configure|pair|setup/i);
    }
  });

  it('the discovery tool takes no input, so the agent cannot pass flow parameters', () => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === 'list_discovered_devices');
    expect(tool?.inputSchema.properties).toEqual({});
    expect(tool?.inputSchema.required).toBeUndefined();
  });
});

describe('search_device_catalog tool', () => {
  it('feeds catalog recommendations into the conversation', async () => {
    const seen: string[] = [];
    const agent = new Agent({
      provider: provider([
        {
          text: '',
          toolCalls: [{ id: 't1', name: 'search_device_catalog', input: { query: 'smart lock' } }],
        },
        { text: 'The Nuki is a solid local pick.', toolCalls: [] },
      ]),
      context: context(),
    });

    const reply = await agent.send('what smart lock should I buy?', (event) => {
      if (event.type === 'tool_result') seen.push(event.content);
    });

    expect(seen).toContain(CATALOG_RESULT);
    expect(reply).toBe('The Nuki is a solid local pick.');
  });

  it('is advisory only, it takes a query but nothing that could add or configure a device', () => {
    const tool = TOOL_DEFINITIONS.find((t) => t.name === 'search_device_catalog');
    expect(Object.keys(tool?.inputSchema.properties ?? {})).toEqual(['query']);
    expect(tool?.inputSchema.required).toBeUndefined();
    expect(tool?.name).not.toMatch(/add_device|configure|pair|purchase|buy|flow/i);
  });
});

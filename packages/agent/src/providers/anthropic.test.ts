import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnthropicProvider } from './anthropic.js';

function mockFetch(): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ content: [{ type: 'text', text: 'hi' }] }),
  }) as unknown as typeof fetch;
}

afterEach(() => vi.restoreAllMocks());

function bodyOf(fetchMock: unknown): Record<string, unknown> {
  const call = (fetchMock as { mock: { calls: unknown[][] } }).mock.calls[0];
  return JSON.parse((call[1] as { body: string }).body);
}

describe('AnthropicProvider web search', () => {
  it('adds the server-side web_search tool when enabled (default)', async () => {
    const fetchFn = mockFetch();
    vi.stubGlobal('fetch', fetchFn);
    const provider = new AnthropicProvider({ apiKey: 'k' });
    await provider.complete({ system: 's', messages: [], tools: [] });
    const tools = bodyOf(fetchFn).tools as Array<{ type?: string; name?: string }>;
    expect(tools.some((t) => t.type === 'web_search_20250305' && t.name === 'web_search')).toBe(
      true,
    );
  });

  it('omits web search when disabled', async () => {
    const fetchFn = mockFetch();
    vi.stubGlobal('fetch', fetchFn);
    const provider = new AnthropicProvider({ apiKey: 'k', webSearch: false });
    await provider.complete({ system: 's', messages: [], tools: [] });
    const tools = bodyOf(fetchFn).tools as Array<{ type?: string }>;
    expect(tools.some((t) => t.type === 'web_search_20250305')).toBe(false);
  });

  it('ignores server-tool result blocks and returns the text answer', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [
          { type: 'server_tool_use', id: 's1', name: 'web_search', input: {} },
          { type: 'web_search_tool_result', tool_use_id: 's1', content: [] },
          { type: 'text', text: 'Found a good doorbell.' },
        ],
      }),
    }) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchFn);
    const provider = new AnthropicProvider({ apiKey: 'k' });
    const turn = await provider.complete({ system: 's', messages: [], tools: [] });
    expect(turn.text).toBe('Found a good doorbell.');
    expect(turn.toolCalls).toEqual([]);
  });
});

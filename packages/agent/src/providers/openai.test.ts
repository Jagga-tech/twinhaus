import { describe, expect, it } from 'vitest';
import { fromOpenAiMessage, toOpenAiMessages } from './openai.js';
import type { ProviderMessage } from '../types.js';

describe('OpenAI wire translation', () => {
  it('prepends the system prompt and maps a plain user turn', () => {
    const messages: ProviderMessage[] = [{ role: 'user', content: 'hi' }];
    const out = toOpenAiMessages('be helpful', messages) as Array<{
      role: string;
      content: string;
    }>;
    expect(out[0]).toEqual({ role: 'system', content: 'be helpful' });
    expect(out[1]).toEqual({ role: 'user', content: 'hi' });
  });

  it('serializes assistant tool calls and tool results', () => {
    const messages: ProviderMessage[] = [
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'c1', name: 'call_service', input: { a: 1 } }],
      },
      { role: 'tool', results: [{ toolCallId: 'c1', content: 'done' }] },
    ];
    const out = toOpenAiMessages('sys', messages) as Array<Record<string, unknown>>;
    const assistant = out[1] as {
      tool_calls: Array<{ id: string; function: { arguments: string } }>;
    };
    expect(assistant.tool_calls[0].id).toBe('c1');
    expect(JSON.parse(assistant.tool_calls[0].function.arguments)).toEqual({ a: 1 });
    expect(out[2]).toMatchObject({ role: 'tool', tool_call_id: 'c1', content: 'done' });
  });

  it('parses an assistant message with tool calls back into the shared shape', () => {
    const turn = fromOpenAiMessage({
      content: 'ok',
      tool_calls: [{ id: 'c9', function: { name: 'get_energy_by_room', arguments: '{"x":2}' } }],
    });
    expect(turn.text).toBe('ok');
    expect(turn.toolCalls[0]).toEqual({ id: 'c9', name: 'get_energy_by_room', input: { x: 2 } });
  });

  it('tolerates malformed tool-call arguments', () => {
    const turn = fromOpenAiMessage({
      content: null,
      tool_calls: [{ id: 'c1', function: { name: 'f', arguments: 'not json' } }],
    });
    expect(turn.text).toBe('');
    expect(turn.toolCalls[0].input).toEqual({});
  });
});

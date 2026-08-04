import { describe, expect, it } from 'vitest';
import { CompanionCore, parseInbound, seedFabric } from './core.js';

describe('CompanionCore', () => {
  it('answers subscribe with a snapshot of the fabric', () => {
    const out = new CompanionCore().handle({ type: 'subscribe' });
    expect(out).toHaveLength(1);
    expect(out[0].type).toBe('snapshot');
    if (out[0].type === 'snapshot') {
      expect(out[0].states.length).toBe(seedFabric().length);
    }
  });

  it('applies a command and emits the resulting event', () => {
    const core = new CompanionCore();
    const out = core.handle({
      type: 'command',
      domain: 'light',
      service: 'turn_on',
      entity_id: 'light.matter_ceiling',
      data: { brightness_pct: 50 },
    });
    expect(out[0].type).toBe('event');
    if (out[0].type === 'event') {
      expect(out[0].state.state).toBe('on');
      expect(out[0].state.attributes.brightness).toBe(128);
    }
  });

  it('unlocks a lock via command', () => {
    const core = new CompanionCore();
    const out = core.handle({
      type: 'command',
      domain: 'lock',
      service: 'unlock',
      entity_id: 'lock.matter_front',
    });
    expect(out[0].type === 'event' && out[0].state.state).toBe('unlocked');
  });

  it('ignores a command for an unknown device', () => {
    const core = new CompanionCore();
    expect(
      core.handle({
        type: 'command',
        domain: 'light',
        service: 'turn_on',
        entity_id: 'light.nope',
      }),
    ).toEqual([]);
  });
});

describe('parseInbound', () => {
  it('parses subscribe and command frames', () => {
    expect(parseInbound('{"type":"subscribe"}')).toEqual({ type: 'subscribe' });
    expect(
      parseInbound('{"type":"command","domain":"light","service":"turn_on","entity_id":"light.a"}'),
    ).toEqual({
      type: 'command',
      domain: 'light',
      service: 'turn_on',
      entity_id: 'light.a',
      data: undefined,
    });
  });

  it('rejects malformed or unknown frames', () => {
    expect(parseInbound('not json')).toBeNull();
    expect(parseInbound('{"type":"nope"}')).toBeNull();
    expect(parseInbound('{"type":"command"}')).toBeNull();
  });
});

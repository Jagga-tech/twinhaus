import { describe, expect, it } from 'vitest';
import { DemoProvider } from './demoProvider.js';
import type { StateChangedEvent } from './types.js';

describe('DemoProvider', () => {
  it('is standalone and connects with no config', async () => {
    const provider = new DemoProvider();
    expect(provider.standalone).toBe(true);
    const statuses: string[] = [];
    provider.onStatusChange((s) => statuses.push(s));
    await provider.connect({});
    expect(provider.getStatus()).toBe('connected');
    expect(statuses).toContain('connected');
  });

  it('seeds a live home', async () => {
    const states = await new DemoProvider().getStates();
    const ids = states.map((s) => s.entity_id);
    expect(ids).toContain('light.demo_living_lamp');
    expect(ids).toContain('lock.demo_front');
    expect(ids.length).toBeGreaterThan(5);
  });

  it('controls a device and emits the resulting state change', async () => {
    const provider = new DemoProvider();
    const events: StateChangedEvent[] = [];
    provider.onStateChanged((e) => events.push(e));

    await provider.callService({
      domain: 'light',
      service: 'turn_on',
      target: { entity_id: 'light.demo_kitchen' },
      serviceData: { brightness_pct: 50 },
    });

    const event = events.find((e) => e.entity_id === 'light.demo_kitchen');
    expect(event?.new_state?.state).toBe('on');
    expect(event?.new_state?.attributes.brightness).toBe(128);

    const states = await provider.getStates();
    expect(states.find((s) => s.entity_id === 'light.demo_kitchen')?.state).toBe('on');
  });

  it('toggles a lock via the service call', async () => {
    const provider = new DemoProvider();
    await provider.callService({
      domain: 'lock',
      service: 'unlock',
      target: { entity_id: 'lock.demo_front' },
    });
    const states = await provider.getStates();
    expect(states.find((s) => s.entity_id === 'lock.demo_front')?.state).toBe('unlocked');
  });

  it('ignores a call for an unknown entity', async () => {
    const provider = new DemoProvider();
    const events: StateChangedEvent[] = [];
    provider.onStateChanged((e) => events.push(e));
    await provider.callService({
      domain: 'light',
      service: 'turn_on',
      target: { entity_id: 'light.nope' },
    });
    expect(events).toHaveLength(0);
  });

  it('drives the ambient simulation through an injected scheduler', async () => {
    let fire: (() => void) | null = null;
    const provider = new DemoProvider({
      setIntervalFn: (handler) => {
        fire = handler;
        return 0 as unknown as ReturnType<typeof setInterval>;
      },
      clearIntervalFn: () => undefined,
      random: () => 0.9,
    });
    const events: StateChangedEvent[] = [];
    provider.onStateChanged((e) => events.push(e));
    await provider.connect({});
    expect(fire).toBeTypeOf('function');
    fire!();
    // random 0.9 > 0.6 to motion detected.
    expect(events.some((e) => e.entity_id === 'binary_sensor.demo_hall_motion')).toBe(true);
  });
});

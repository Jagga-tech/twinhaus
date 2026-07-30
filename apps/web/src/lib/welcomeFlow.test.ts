import { describe, expect, it } from 'vitest';
import { resolveWelcome, type WelcomeInput } from './welcomeFlow.js';

const FRESH: WelcomeInput = {
  connected: false,
  hasLayout: false,
  hasDevices: false,
  positioningReady: false,
  agentUsed: false,
  levelCount: 1,
};

describe('resolveWelcome', () => {
  it('starts everyone at connect', () => {
    const flow = resolveWelcome(FRESH);
    expect(flow.currentId).toBe('connect');
    expect(flow.doneCount).toBe(0);
    expect(flow.allRequiredDone).toBe(false);
  });

  it('advances the current step as prerequisites are met', () => {
    expect(resolveWelcome({ ...FRESH, connected: true }).currentId).toBe('scan');
    expect(resolveWelcome({ ...FRESH, connected: true, hasLayout: true }).currentId).toBe(
      'control',
    );
  });

  it('surfaces the optional locate step before talk', () => {
    const flow = resolveWelcome({
      ...FRESH,
      connected: true,
      hasLayout: true,
      hasDevices: true,
    });
    expect(flow.currentId).toBe('locate');
    expect(flow.steps.find((s) => s.id === 'locate')?.optional).toBe(true);
  });

  it('counts required steps done even while the optional one is skipped', () => {
    const flow = resolveWelcome({
      connected: true,
      hasLayout: true,
      hasDevices: true,
      positioningReady: false,
      agentUsed: true,
      levelCount: 1,
    });
    // locate (optional) is still not done, so it's the nudge…
    expect(flow.currentId).toBe('locate');
    // …but every required step is done, so the flow can be finished.
    expect(flow.allRequiredDone).toBe(true);
  });

  it('is fully complete when every step including optional is done', () => {
    const flow = resolveWelcome({
      connected: true,
      hasLayout: true,
      hasDevices: true,
      positioningReady: true,
      agentUsed: true,
      levelCount: 2,
    });
    expect(flow.currentId).toBeNull();
    expect(flow.doneCount).toBe(flow.total);
    expect(flow.allRequiredDone).toBe(true);
  });

  it('nudges the optional floors step only once required steps are done', () => {
    const flow = resolveWelcome({
      connected: true,
      hasLayout: true,
      hasDevices: true,
      positioningReady: true,
      agentUsed: true,
      levelCount: 1,
    });
    expect(flow.currentId).toBe('floors');
    expect(flow.allRequiredDone).toBe(true);
    expect(flow.steps.find((s) => s.id === 'floors')?.optional).toBe(true);
  });

  it('marks exactly one step current and re-opens if a prerequisite regresses', () => {
    const connected = resolveWelcome({ ...FRESH, connected: true });
    expect(connected.steps.filter((s) => s.current)).toHaveLength(1);
    // Disconnecting re-opens connect as the current step.
    expect(resolveWelcome(FRESH).currentId).toBe('connect');
  });
});

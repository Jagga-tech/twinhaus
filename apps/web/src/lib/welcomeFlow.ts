/**
 * The first-run spine. Twinhaus has many features living in separate tabs; this resolves them into
 * one ordered journey — connect → scan → control → locate → talk — and tracks progress from live
 * app state rather than a stored cursor, so a step ticks off the moment the user actually does it
 * (and un-ticks if they undo it). Pure and state-driven, so the whole flow is unit-tested.
 */

export type WelcomeStepId = 'connect' | 'scan' | 'control' | 'locate' | 'talk' | 'floors';

/** The signals a step's completion is derived from — a snapshot of what the user has done so far. */
export interface WelcomeInput {
  connected: boolean;
  hasLayout: boolean;
  hasDevices: boolean;
  positioningReady: boolean;
  agentUsed: boolean;
  /** Number of floors/levels in the twin; >1 means a multi-storey home is set up. */
  levelCount: number;
}

export interface WelcomeStep {
  id: WelcomeStepId;
  title: string;
  body: string;
  /** Where the user goes to act on it (a left-panel tab id, or 'settings' / 'chat'). */
  target: string;
  /** Optional steps don't block "you're all set" — they're nudges, not gates. */
  optional: boolean;
  done: boolean;
  current: boolean;
}

interface StepSpec {
  id: WelcomeStepId;
  title: string;
  body: string;
  target: string;
  optional: boolean;
  isDone: (input: WelcomeInput) => boolean;
}

const SPECS: StepSpec[] = [
  {
    id: 'connect',
    title: 'Connect Home Assistant',
    body: 'Paste your HA URL and a long-lived token in Settings. Everything else builds on this.',
    target: 'settings',
    optional: false,
    isDone: (input) => input.connected,
  },
  {
    id: 'scan',
    title: 'Build your home',
    body: 'Scan from Home Assistant to generate rooms and place devices automatically — no drawing. Or start from a template.',
    target: 'import',
    optional: false,
    isDone: (input) => input.hasLayout,
  },
  {
    id: 'control',
    title: 'Control your twin',
    body: 'Tap a device in the 3D view to control it. No smart devices yet? Open Simulate → Recommend to plan a kit and preview it.',
    target: 'simulate',
    optional: false,
    isDone: (input) => input.hasDevices,
  },
  {
    id: 'locate',
    title: 'See devices move (optional)',
    body: 'Add a few Bluetooth proxies to track where devices and people actually are, live in the twin.',
    target: 'import',
    optional: true,
    isDone: (input) => input.positioningReady,
  },
  {
    id: 'talk',
    title: 'Talk to your home',
    body: 'Try "turn the house down for the night". Guarded actions ask before they run.',
    target: 'chat',
    optional: false,
    isDone: (input) => input.agentUsed,
  },
  {
    id: 'floors',
    title: 'Add your floors (optional)',
    body: 'Multi-storey home? Add each floor and switch between them — or scan, and HA floors become levels automatically.',
    target: 'import',
    optional: true,
    isDone: (input) => input.levelCount > 1,
  },
];

export interface WelcomeState {
  steps: WelcomeStep[];
  /** The step to nudge next (first not-done, optional included), or null when everything's done. */
  currentId: WelcomeStepId | null;
  doneCount: number;
  total: number;
  /** True once every required step is done — the flow can be finished even if optional ones remain. */
  allRequiredDone: boolean;
}

/** Resolve the full flow state from a snapshot of what the user has done. */
export function resolveWelcome(input: WelcomeInput): WelcomeState {
  const firstIncomplete = SPECS.find((spec) => !spec.isDone(input));
  const currentId = firstIncomplete?.id ?? null;

  const steps: WelcomeStep[] = SPECS.map((spec) => ({
    id: spec.id,
    title: spec.title,
    body: spec.body,
    target: spec.target,
    optional: spec.optional,
    done: spec.isDone(input),
    current: spec.id === currentId,
  }));

  return {
    steps,
    currentId,
    doneCount: steps.filter((step) => step.done).length,
    total: steps.length,
    allRequiredDone: SPECS.every((spec) => spec.optional || spec.isDone(input)),
  };
}

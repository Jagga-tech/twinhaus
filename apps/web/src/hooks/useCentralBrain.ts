import { useEffect, useRef } from 'react';
import { useTwinStore } from '../store/twinStore.js';
import { activeProvider } from '../lib/provider/index.js';
import { centralBrain } from '../lib/brain.js';

/** Do not repeat the same auto action within this window, to avoid fighting the user or looping. */
const COOLDOWN_MS = 60_000;

/**
 * The central-brain supervisor. Whenever live state changes it re-runs the brain over the whole
 * home. In `auto` mode it executes the safe decisions itself (with a per-decision cooldown so it
 * never loops or fights the user) and logs them; guarded decisions are only ever surfaced, never
 * run without approval. In `suggest` mode it just logs what it would do. In `off` mode it sleeps.
 */
export function useCentralBrain(): void {
  const brainMode = useTwinStore((state) => state.brainMode);
  const entityStates = useTwinStore((state) => state.entityStates);
  const connectionStatus = useTwinStore((state) => state.connectionStatus);
  const lastRun = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (brainMode === 'off' || connectionStatus !== 'connected') return;

    // Debounce so a burst of state_changed events triggers one evaluation.
    const timer = setTimeout(() => {
      const decisions = centralBrain(entityStates);
      if (decisions.length === 0) return;
      const now = Date.now();
      const store = useTwinStore.getState();

      for (const decision of decisions) {
        const firedAt = lastRun.current.get(decision.id) ?? 0;
        if (now - firedAt < COOLDOWN_MS) continue;

        if (decision.risk === 'auto' && brainMode === 'auto') {
          lastRun.current.set(decision.id, now);
          store.addBrainLog(`Did: ${decision.title} (${decision.reason})`);
          Promise.all(decision.calls.map((call) => activeProvider().callService(call))).catch(() =>
            store.addBrainLog(`Could not complete: ${decision.title}`),
          );
        } else {
          // suggest mode, or a guarded decision in auto mode: surface it, do not run it.
          lastRun.current.set(decision.id, now);
          store.addBrainLog(`Suggests: ${decision.title} (${decision.reason})`);
        }
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [brainMode, entityStates, connectionStatus]);
}

import { useMemo, useState } from 'react';
import type { CallServiceOptions } from '@twinhaus/ha-bridge';
import { useTwinStore } from '../../store/twinStore.js';
import { activeProvider } from '../../lib/provider/index.js';
import { centralBrain, type BrainMode } from '../../lib/brain.js';
import { learnRoutines, type RoutineSuggestion } from '../../lib/patterns.js';
import { entityLabel } from '../../lib/deviceState.js';
import type { SceneEntry } from '../../lib/scenes.js';

const MODES: Array<{ id: BrainMode; label: string; hint: string }> = [
  { id: 'off', label: 'Off', hint: 'The brain does nothing.' },
  { id: 'suggest', label: 'Suggest', hint: 'It watches and suggests, you approve every action.' },
  { id: 'auto', label: 'Autopilot', hint: 'It runs safe actions itself; guarded ones still ask.' },
];

/**
 * The central brain's control panel: one supervisor over every connected system. Pick how much
 * autonomy it has, see what it wants to do right now across the whole home, and review what it has
 * done. Safe actions can run themselves in autopilot; anything touching security or comfort is only
 * ever suggested for you to approve.
 */
export function BrainPanel() {
  const brainMode = useTwinStore((state) => state.brainMode);
  const setBrainMode = useTwinStore((state) => state.setBrainMode);
  const entityStates = useTwinStore((state) => state.entityStates);
  const connectionStatus = useTwinStore((state) => state.connectionStatus);
  const brainLog = useTwinStore((state) => state.brainLog);
  const observations = useTwinStore((state) => state.brainObservations);
  const addScene = useTwinStore((state) => state.addScene);
  const [busy, setBusy] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const decisions = useMemo(() => centralBrain(entityStates), [entityStates]);
  const routines = useMemo(() => learnRoutines(observations), [observations]);

  async function runCalls(id: string, calls: CallServiceOptions[]) {
    setBusy(id);
    try {
      for (const call of calls) await activeProvider().callService(call);
    } finally {
      setBusy(null);
    }
  }

  function saveRoutine(routine: RoutineSuggestion) {
    const entries: SceneEntry[] = routine.calls.map((call) => ({
      entityId: typeof call.target?.entity_id === 'string' ? call.target.entity_id : '',
      service: call.service,
      data: call.serviceData,
    }));
    addScene({ name: routine.title, entries });
    setSaved(routine.id);
  }

  function labelFor(call: CallServiceOptions): string {
    const id = typeof call.target?.entity_id === 'string' ? call.target.entity_id : '';
    return entityLabel(id, entityStates[id]);
  }

  async function run(id: string) {
    const decision = decisions.find((d) => d.id === id);
    if (!decision) return;
    await runCalls(id, decision.calls);
    useTwinStore.getState().addBrainLog(`Did: ${decision.title}`);
  }

  return (
    <div className="panel-block">
      <h4 className="section-heading">Central brain</h4>
      <div className="brain-modes">
        {MODES.map((mode) => (
          <button
            key={mode.id}
            className={brainMode === mode.id ? 'active' : ''}
            onClick={() => setBrainMode(mode.id)}
          >
            {mode.label}
          </button>
        ))}
      </div>
      <p className="hint">{MODES.find((m) => m.id === brainMode)?.hint}</p>

      {connectionStatus !== 'connected' ? (
        <p className="hint">Connect a backend and the brain will watch the whole home.</p>
      ) : (
        <>
          <h4 className="section-heading">Right now</h4>
          {decisions.length === 0 ? (
            <p className="hint">Nothing to do, the home looks settled.</p>
          ) : (
            <ul className="brain-list">
              {decisions.map((decision) => (
                <li key={decision.id} className="brain-item">
                  <div className="brain-item-body">
                    <span className="brain-title">{decision.title}</span>
                    <span className="hint">{decision.reason}</span>
                  </div>
                  <span className="brain-actions">
                    <span className={`brain-risk brain-${decision.risk}`}>
                      {decision.risk === 'auto' ? 'safe' : 'needs ok'}
                    </span>
                    <button
                      className="link"
                      disabled={busy === decision.id}
                      onClick={() => run(decision.id)}
                    >
                      {busy === decision.id ? 'Working...' : 'Do it'}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h4 className="section-heading">What it is learning</h4>
          {routines.length === 0 ? (
            <p className="hint">
              Use your home for a few days and the brain will spot the routines in how you use it,
              then offer to save them.
            </p>
          ) : (
            <ul className="brain-list">
              {routines.map((routine) => (
                <li key={routine.id} className="brain-item">
                  <div className="brain-item-body">
                    <span className="brain-title">{routine.title}</span>
                    <span className="hint">
                      {routine.calls.map(labelFor).join(', ')} · seen {routine.observedDays} days
                    </span>
                  </div>
                  <span className="brain-actions">
                    <button
                      className="link"
                      disabled={busy === routine.id}
                      onClick={() => runCalls(routine.id, routine.calls)}
                    >
                      {busy === routine.id ? 'Working...' : 'Do it now'}
                    </button>
                    <button
                      className="link"
                      disabled={saved === routine.id}
                      onClick={() => saveRoutine(routine)}
                    >
                      {saved === routine.id ? 'Saved' : 'Save as scene'}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {brainLog.length > 0 && (
            <>
              <h4 className="section-heading">Recent</h4>
              <ul className="brain-log">
                {brainLog.map((entry, index) => (
                  <li key={index}>{entry}</li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}

import { useMemo } from 'react';
import { useTwinStore } from '../store/twinStore.js';
import { positioningStatus } from '../lib/positioningSources.js';
import { resolveWelcome, type WelcomeStep } from '../lib/welcomeFlow.js';

/**
 * The first-run spine. A dismissible checklist that threads Twinhaus's features into one journey, * connect to build to control to locate to talk, steering the user to the right tab for each step and
 * ticking steps off live as they're done. It's guidance, not a wall: the app stays fully usable
 * underneath, and finishing or skipping hides it for good.
 */
export function WelcomeFlow({ onOpenSettings }: { onOpenSettings: () => void }) {
  const dismissed = useTwinStore((state) => state.welcomeDismissed);
  const connectionStatus = useTwinStore((state) => state.connectionStatus);
  const rooms = useTwinStore((state) => state.rooms);
  const devices = useTwinStore((state) => state.devices);
  const entityStates = useTwinStore((state) => state.entityStates);
  const agentUsed = useTwinStore((state) => state.agentUsed);
  const levelCount = useTwinStore((state) => state.levels.length);
  const setActiveLeftTab = useTwinStore((state) => state.setActiveLeftTab);
  const setWelcomeDismissed = useTwinStore((state) => state.setWelcomeDismissed);

  const flow = useMemo(
    () =>
      resolveWelcome({
        connected: connectionStatus === 'connected',
        hasLayout: rooms.length > 0,
        hasDevices: devices.length > 0,
        positioningReady: positioningStatus(devices, entityStates).ready,
        agentUsed,
        levelCount,
      }),
    [connectionStatus, rooms.length, devices.length, entityStates, agentUsed, levelCount],
  );

  if (dismissed) return null;

  function goTo(step: WelcomeStep) {
    if (step.target === 'settings') onOpenSettings();
    else if (step.target !== 'chat') setActiveLeftTab(step.target);
  }

  return (
    <div className="welcome">
      <div className="welcome-header">
        <strong>Get started</strong>
        <span className="welcome-progress">
          {flow.doneCount}/{flow.total}
        </span>
        <button className="link" onClick={() => setWelcomeDismissed(true)}>
          {flow.allRequiredDone ? 'Finish' : 'Skip'}
        </button>
      </div>

      {flow.allRequiredDone && (
        <p className="welcome-done">Your home is live. Explore, or finish the tour.</p>
      )}

      <ol className="welcome-steps">
        {flow.steps.map((step) => (
          <li
            key={step.id}
            className={`welcome-step${step.done ? ' done' : ''}${step.current ? ' current' : ''}`}
          >
            <span className="welcome-check">{step.done ? 'done' : ''}</span>
            <div className="welcome-step-body">
              <span className="welcome-step-title">
                {step.title}
                {step.optional && !step.done ? ', optional' : ''}
              </span>
              {step.current && (
                <>
                  <p className="welcome-step-text">{step.body}</p>
                  {step.target !== 'chat' && (
                    <button className="primary welcome-go" onClick={() => goTo(step)}>
                      {step.target === 'settings' ? 'Open Settings' : 'Take me there'}
                    </button>
                  )}
                </>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

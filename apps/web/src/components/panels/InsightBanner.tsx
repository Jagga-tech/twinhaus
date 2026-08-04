import { useMemo, useState } from 'react';
import { useTwinStore } from '../../store/twinStore.js';
import { activeProvider } from '../../lib/provider/index.js';
import { homeInsights } from '../../lib/homeInsights.js';
import { insightFix } from '../../lib/insightFix.js';

/**
 * Proactive banner over the twin: surfaces what homeInsights notices (an unlocked lock, lights
 * left on, climate waste) without the user having to ask, and offers a one-tap fix where there is
 * one. Hidden when nothing needs attention.
 */
export function InsightBanner() {
  const rooms = useTwinStore((state) => state.rooms);
  const devices = useTwinStore((state) => state.devices);
  const entityStates = useTwinStore((state) => state.entityStates);
  const connectionStatus = useTwinStore((state) => state.connectionStatus);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const insights = useMemo(
    () => homeInsights(rooms, devices, entityStates).filter((i) => i.severity !== 'info'),
    [rooms, devices, entityStates],
  );
  const shown = insights.filter((i) => !dismissed.includes(i.id)).slice(0, 3);

  if (connectionStatus !== 'connected' || shown.length === 0) return null;

  async function applyFix(insightId: string) {
    const insight = insights.find((i) => i.id === insightId);
    if (!insight) return;
    const fix = insightFix(insight, entityStates);
    if (!fix) return;
    setBusy(insightId);
    try {
      for (const call of fix.calls) await activeProvider().callService(call);
      setDismissed((prev) => [...prev, insightId]);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="insight-banner">
      {shown.map((insight) => {
        const fix = insightFix(insight, entityStates);
        return (
          <div key={insight.id} className={`insight-row insight-${insight.severity}`}>
            <span className="insight-message">{insight.message}</span>
            <span className="insight-actions">
              {fix && (
                <button
                  className="link"
                  disabled={busy === insight.id}
                  onClick={() => applyFix(insight.id)}
                >
                  {busy === insight.id ? 'Working...' : fix.label}
                </button>
              )}
              <button
                className="link insight-dismiss"
                onClick={() => setDismissed((prev) => [...prev, insight.id])}
              >
                Dismiss
              </button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

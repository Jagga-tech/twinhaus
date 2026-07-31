import { useEffect, useState } from 'react';
import type { DeviceProvider } from '../lib/provider/index.js';
import { activeProvider, haClient } from '../lib/provider/index.js';
import { useTwinStore } from '../store/twinStore.js';

// Re-exported so the HA-only seams (registry home-scan, config-flow discovery) keep one import site.
export { haClient };

/**
 * Mirror a backend's live state into the store: connection status, per-entity changes, and a full
 * snapshot reload after an auto-reconnect (events are missed while offline). Returns a teardown so
 * the wiring can be swapped when the user switches backends.
 */
export function wireProviderToStore(provider: DeviceProvider): () => void {
  const offs = [
    provider.onStatusChange((status) => useTwinStore.getState().setConnectionStatus(status)),
    provider.onStateChanged((event) =>
      useTwinStore.getState().applyStateChange(event.entity_id, event.new_state),
    ),
    provider.onReconnected(() => {
      provider
        .getStates()
        .then((states) => useTwinStore.getState().setEntityStates(states))
        .catch(() => undefined);
    }),
  ];
  return () => offs.forEach((off) => off());
}

// Wire the default backend for the app's lifetime. Switching backends re-wires via the same helper.
wireProviderToStore(activeProvider());

interface UseHaConnection {
  connect: () => Promise<void>;
  disconnect: () => void;
  error: string | null;
  connecting: boolean;
}

/** Manage the active backend's connection lifecycle and load the initial entity snapshot. */
export function useHaConnection(): UseHaConnection {
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  async function connect() {
    const provider = activeProvider();
    const { haConfig, setEntityStates } = useTwinStore.getState();
    setConnecting(true);
    setError(null);
    try {
      // Each backend validates its own config: HA rejects a missing URL/token, Demo ignores it.
      await provider.connect({ ...haConfig });
      setEntityStates(await provider.getStates());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setConnecting(false);
    }
  }

  function disconnect() {
    activeProvider().disconnect();
  }

  useEffect(() => () => undefined, []);

  return { connect, disconnect, error, connecting };
}

import { useState } from 'react';
import type { DeviceProvider } from '../lib/provider/index.js';
import { activeProvider, getProvider, haClient, setActiveProvider } from '../lib/provider/index.js';
import { demoHome } from '../lib/demoHome.js';
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

// Restore the backend the user last chose (persisted), then wire it for the app's lifetime.
const savedProviderId = useTwinStore.getState().providerId;
if (savedProviderId && getProvider(savedProviderId)) setActiveProvider(savedProviderId);
let unwire = wireProviderToStore(activeProvider());

interface UseHaConnection {
  connect: () => Promise<void>;
  disconnect: () => void;
  switchProvider: (id: string) => void;
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

  /**
   * Switch the device backend: tear down the old connection and wiring, make the new one active,
   * re-wire it to the store, and clear the stale live mirror. Selecting the standalone Demo backend
   * also seeds a furnished home when the twin is still empty, so it has something to show.
   */
  function switchProvider(id: string) {
    const next = getProvider(id);
    if (!next || next.id === activeProvider().id) return;
    setError(null);
    activeProvider().disconnect();
    unwire();
    setActiveProvider(id);
    unwire = wireProviderToStore(next);

    const store = useTwinStore.getState();
    store.setProviderId(id);
    store.setEntityStates([]);
    if (next.standalone && store.rooms.length === 0) store.importTwin(demoHome());
  }

  return { connect, disconnect, switchProvider, error, connecting };
}

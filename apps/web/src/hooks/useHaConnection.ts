import { useEffect, useState } from 'react';
import { HaClient } from '@twinhaus/ha-bridge';
import { useTwinStore } from '../store/twinStore.js';

/** Shared client instance — the chat agent and the viewer both act on the same connection. */
export const haClient = new HaClient();

// Keep the store's live mirror in sync with Home Assistant for the app's lifetime.
haClient.onStatusChange((status) => useTwinStore.getState().setConnectionStatus(status));
haClient.onStateChanged((event) => {
  useTwinStore.getState().applyStateChange(event.entity_id, event.new_state);
});

interface UseHaConnection {
  connect: () => Promise<void>;
  disconnect: () => void;
  error: string | null;
  connecting: boolean;
}

/** Manage the connection lifecycle and load the initial entity snapshot on connect. */
export function useHaConnection(): UseHaConnection {
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  async function connect() {
    const { haConfig, setEntityStates } = useTwinStore.getState();
    if (!haConfig.url || !haConfig.token) {
      setError('Enter your Home Assistant URL and access token in Settings first.');
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      await haClient.connect(haConfig);
      setEntityStates(await haClient.getStates());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setConnecting(false);
    }
  }

  function disconnect() {
    haClient.disconnect();
  }

  // Tear down the socket if the component using this hook unmounts for good.
  useEffect(() => () => undefined, []);

  return { connect, disconnect, error, connecting };
}

import { useEffect } from 'react';
import { normalizeFlows } from '@twinhaus/discovery';
import { useTwinStore } from '../store/twinStore.js';
import { createDiscoveryTransport } from '../lib/discoveryTransport.js';

/**
 * Keeps the store's discovered-device list in sync while Home Assistant is connected. Subscribes
 * to config-flow changes on connect and tears down on disconnect. Mount once (in App).
 */
export function useDiscovery(): void {
  const status = useTwinStore((state) => state.connectionStatus);
  const setDiscovered = useTwinStore((state) => state.setDiscovered);

  useEffect(() => {
    if (status !== 'connected') {
      setDiscovered([]);
      return;
    }
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    const transport = createDiscoveryTransport();
    transport
      .subscribeFlows((flows) => {
        if (!cancelled) setDiscovered(normalizeFlows(flows));
      })
      .then((fn) => {
        if (cancelled) fn();
        else unsubscribe = fn;
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [status, setDiscovered]);
}

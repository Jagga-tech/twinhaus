import type { DiscoveryTransport } from '@twinhaus/discovery';
import { haClient } from '../hooks/useHaConnection.js';

const POLL_INTERVAL_MS = 15000;

/**
 * Implements the discovery seam against the shared Home Assistant connection — the web analog
 * of how `homeContext` wires the agent. Discovery logic stays in `@twinhaus/discovery`; this is
 * the only place it touches `ha-bridge`. HA remains the discovery layer; we just consume flows.
 *
 * Live updates come from HA's config-flow subscription; if that command isn't available we fall
 * back to polling, so the tray still refreshes.
 */
export function createDiscoveryTransport(): DiscoveryTransport {
  return {
    async subscribeFlows(onFlows) {
      const refresh = async () => {
        try {
          onFlows(await haClient.listConfigFlows());
        } catch {
          onFlows([]);
        }
      };
      await refresh();

      let unsubscribe: (() => void) | null = null;
      let poll: ReturnType<typeof setInterval> | null = null;
      try {
        unsubscribe = await haClient.subscribeConfigFlows(refresh);
      } catch {
        poll = setInterval(refresh, POLL_INTERVAL_MS);
      }

      return () => {
        unsubscribe?.();
        if (poll) clearInterval(poll);
      };
    },

    getFlow: (flowId) => haClient.getConfigFlow(flowId),
    stepFlow: (flowId, input) => haClient.stepConfigFlow(flowId, input),
    abortFlow: (flowId) => haClient.abortConfigFlow(flowId),
  };
}

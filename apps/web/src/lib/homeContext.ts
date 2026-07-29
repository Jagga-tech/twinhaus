import type { HomeContext } from '@twinhaus/agent';
import type { HaClient } from '@twinhaus/ha-bridge';
import { entitySummary } from './deviceState.js';
import { useTwinStore } from '../store/twinStore.js';

/**
 * Bridges the agent's tools to the twin state engine and the Home Assistant client.
 *
 * The agent package deliberately knows nothing about the store or the WebSocket bridge —
 * this adapter is where "command down / event up" is wired: tool calls flow into HA service
 * calls, and the resulting `state_changed` events flow back into the twin on their own.
 */
export function createHomeContext(client: HaClient): HomeContext {
  return {
    async describeHome() {
      const { rooms, devices, entityStates } = useTwinStore.getState();
      if (rooms.length === 0)
        return 'The twin has no rooms yet. The user should draw a floor plan.';

      const lines: string[] = [];
      for (const room of rooms) {
        const inRoom = devices.filter((device) => device.roomId === room.id);
        lines.push(`Room "${room.name}":`);
        if (inRoom.length === 0) {
          lines.push('  (no devices placed)');
          continue;
        }
        for (const device of inRoom) {
          const state = entityStates[device.entityId];
          lines.push(`  - ${state ? entitySummary(state) : `${device.entityId} (state unknown)`}`);
        }
      }
      return lines.join('\n');
    },

    async getRoomDevices(roomName) {
      const { rooms, devices, entityStates } = useTwinStore.getState();
      const room = rooms.find((r) => r.name.toLowerCase() === roomName.trim().toLowerCase());
      if (!room) {
        const names = rooms.map((r) => `"${r.name}"`).join(', ') || '(none)';
        return `No room named "${roomName}". Known rooms: ${names}.`;
      }
      const inRoom = devices.filter((device) => device.roomId === room.id);
      if (inRoom.length === 0) return `Room "${room.name}" has no devices placed.`;
      return inRoom
        .map((device) => {
          const state = entityStates[device.entityId];
          return state ? entitySummary(state) : `${device.entityId} (state unknown)`;
        })
        .join('\n');
    },

    async callService({ domain, service, entityId, data }) {
      await client.callService({
        domain,
        service,
        target: { entity_id: entityId },
        serviceData: data,
      });
      return `Called ${domain}.${service} on ${entityId}.`;
    },
  };
}

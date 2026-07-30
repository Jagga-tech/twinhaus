import type { HomeContext } from '@twinhaus/agent';
import { entityDomain, type HaClient } from '@twinhaus/ha-bridge';
import { searchCatalog } from '@twinhaus/discovery';
import { confirmState, expectedStateFor, withRetry } from './verifyAction.js';
import { entitySummary } from './deviceState.js';
import { computeRoomEnergy } from './energy.js';
import { useTwinStore } from '../store/twinStore.js';

/**
 * Bridges the agent's tools to the twin state engine and the Home Assistant client.
 *
 * The agent package deliberately knows nothing about the store or the WebSocket bridge, * this adapter is where "command down / event up" is wired: tool calls flow into HA service
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

    async listEntities(domain) {
      const { entityStates } = useTwinStore.getState();
      const all = Object.values(entityStates)
        .filter((state) => !domain || entityDomain(state.entity_id) === domain)
        .sort((a, b) => a.entity_id.localeCompare(b.entity_id));
      if (all.length === 0) {
        return domain
          ? `No entities in domain "${domain}".`
          : 'No entities, Home Assistant is not connected.';
      }
      // Cap the listing so a large home doesn't blow the context window.
      const shown = all.slice(0, 100);
      const suffix = all.length > shown.length ? `\n…and ${all.length - shown.length} more.` : '';
      return shown.map((state) => entitySummary(state)).join('\n') + suffix;
    },

    async getEnergyByRoom() {
      const { rooms, devices, entityStates } = useTwinStore.getState();
      const energy = computeRoomEnergy(rooms, devices, entityStates);
      if (energy.max === 0)
        return 'No power readings available. Place a power/energy sensor in a room.';
      const lines = rooms.map(
        (room) => `${room.name}: ${Math.round(energy.byRoom[room.id] ?? 0)} W`,
      );
      lines.push(`Total: ${Math.round(energy.total)} W`);
      return lines.join('\n');
    },

    async listDiscoveredDevices() {
      const { discovered, connectionStatus } = useTwinStore.getState();
      if (connectionStatus !== 'connected') return 'Home Assistant is not connected.';
      if (discovered.length === 0) return 'Nothing new, no unconfigured devices discovered.';
      return discovered
        .map((device) => `${device.name}, ${device.brand} (via ${device.source})`)
        .join('\n');
    },

    async searchDeviceCatalog(query) {
      const matches = searchCatalog(query ?? '');
      if (matches.length === 0) {
        return `No catalog devices match "${query ?? ''}". Try a category (light, lock, camera) or a protocol (zigbee, matter).`;
      }
      const shown = matches.slice(0, 12);
      const lines = shown.map((device) => {
        const protocols = device.protocols.join('/');
        const note = device.note ? `, ${device.note}` : '';
        return `${device.brand} ${device.model} (${device.category}), ~$${device.approxPriceUsd}, ${protocols}, ${device.setup} setup via Home Assistant "${device.integration}"${note}`;
      });
      const suffix =
        matches.length > shown.length ? `\n…and ${matches.length - shown.length} more.` : '';
      return (
        `${lines.join('\n')}${suffix}\n\n` +
        'These are recommendations only, the user adds any device through Home Assistant.'
      );
    },

    async callService({ domain, service, entityId, data }) {
      await withRetry(() =>
        client.callService({
          domain,
          service,
          target: { entity_id: entityId },
          serviceData: data,
        }),
      );

      const expected = expectedStateFor(domain, service);
      if (!expected || !entityId) return `Called ${domain}.${service} on ${entityId}.`;

      const read = () => useTwinStore.getState().entityStates[entityId]?.state;
      const confirmed = await confirmState(read, expected);
      if (confirmed) {
        return `Called ${domain}.${service} on ${entityId}, confirmed it is now "${expected}".`;
      }
      const current = read() ?? 'unknown';
      return `Called ${domain}.${service} on ${entityId}, but couldn't confirm it took effect (still "${current}"). The device may be offline or slow, tell the user rather than assuming it worked.`;
    },
  };
}

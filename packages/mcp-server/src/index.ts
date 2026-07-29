#!/usr/bin/env tsx
import { readFileSync } from 'node:fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { HaClient, entityDomain, type HaEntityState } from '@twinhaus/ha-bridge';

/**
 * Twinhaus MCP server — lets any MCP-capable AI assistant query your home and control it.
 *
 * It reads the twin document (rooms + device placements) exported from the web app, and
 * optionally connects to Home Assistant for live state and service calls. This is the Phase 4
 * "any AI assistant can query your home" surface.
 *
 * Config (environment variables):
 *   TWINHAUS_TWIN  path to a twin.json exported from the Twinhaus web app (required)
 *   HA_URL         Home Assistant base URL (optional — enables live state + control)
 *   HA_TOKEN       Home Assistant long-lived access token (optional)
 */

interface TwinModel {
  rooms: Array<{ id: string; name: string }>;
  devices: Array<{ entityId: string; roomId: string }>;
}

function loadTwin(): TwinModel {
  const path = process.env.TWINHAUS_TWIN;
  if (!path)
    throw new Error('Set TWINHAUS_TWIN to a twin.json exported from the Twinhaus web app.');
  const data = JSON.parse(readFileSync(path, 'utf8')) as Partial<TwinModel>;
  return { rooms: data.rooms ?? [], devices: data.devices ?? [] };
}

const twin = loadTwin();
const client = new HaClient();
let states: Record<string, HaEntityState> = {};
let haReady = false;

async function ensureHa(): Promise<boolean> {
  if (haReady) return true;
  const url = process.env.HA_URL;
  const token = process.env.HA_TOKEN;
  if (!url || !token) return false;
  await client.connect({ url, token });
  client.onStateChanged((event) => {
    if (event.new_state) states[event.entity_id] = event.new_state;
    else delete states[event.entity_id];
  });
  states = Object.fromEntries((await client.getStates()).map((s) => [s.entity_id, s]));
  haReady = true;
  return true;
}

function stateText(entityId: string): string {
  const state = states[entityId];
  if (!state) return `${entityId} (state unknown)`;
  const unit = state.attributes.unit_of_measurement;
  const value = unit ? `${state.state} ${unit}` : state.state;
  const name = state.attributes.friendly_name ?? entityId;
  return `${name} (${entityId}): ${value}`;
}

function powerWatts(entityId: string): number {
  const state = states[entityId];
  if (!state) return 0;
  const attr = state.attributes.current_power_w;
  if (typeof attr === 'number') return attr;
  if (state.attributes.device_class === 'power') {
    const value = Number(state.state);
    return Number.isFinite(value)
      ? state.attributes.unit_of_measurement === 'kW'
        ? value * 1000
        : value
      : 0;
  }
  return 0;
}

const server = new McpServer({ name: 'twinhaus', version: '0.1.0' });

server.tool('list_rooms', 'List the rooms in the home twin.', {}, async () => ({
  content: [
    {
      type: 'text',
      text: twin.rooms.length
        ? twin.rooms.map((room) => `- ${room.name}`).join('\n')
        : 'No rooms in the twin.',
    },
  ],
}));

server.tool(
  'list_devices',
  'List devices in the twin, optionally filtered to a room, with live state if Home Assistant is connected.',
  { room: z.string().optional().describe('Room name to filter by.') },
  async ({ room }) => {
    await ensureHa();
    const targetRoom = room
      ? twin.rooms.find((r) => r.name.toLowerCase() === room.toLowerCase())
      : undefined;
    if (room && !targetRoom) {
      return { content: [{ type: 'text', text: `No room named "${room}".` }] };
    }
    const devices = twin.devices.filter((d) => !targetRoom || d.roomId === targetRoom.id);
    const text = devices.length
      ? devices.map((d) => stateText(d.entityId)).join('\n')
      : 'No devices placed.';
    return { content: [{ type: 'text', text }] };
  },
);

server.tool(
  'get_device_state',
  'Get the live state of a single entity.',
  { entity_id: z.string().describe('e.g. light.living_room') },
  async ({ entity_id }) => {
    if (!(await ensureHa())) {
      return {
        content: [
          { type: 'text', text: 'Home Assistant not configured (set HA_URL and HA_TOKEN).' },
        ],
      };
    }
    return { content: [{ type: 'text', text: stateText(entity_id) }] };
  },
);

server.tool('get_energy_by_room', 'Report current power draw per room in watts.', {}, async () => {
  if (!(await ensureHa())) {
    return {
      content: [{ type: 'text', text: 'Home Assistant not configured (set HA_URL and HA_TOKEN).' }],
    };
  }
  const lines = twin.rooms.map((room) => {
    const watts = twin.devices
      .filter((d) => d.roomId === room.id)
      .reduce((sum, d) => sum + powerWatts(d.entityId), 0);
    return `${room.name}: ${Math.round(watts)} W`;
  });
  return { content: [{ type: 'text', text: lines.join('\n') || 'No rooms.' }] };
});

server.tool(
  'call_service',
  'Control a device via a Home Assistant service call on one entity.',
  {
    domain: z.string().describe('e.g. light, lock, switch'),
    service: z.string().describe('e.g. turn_on, turn_off, lock'),
    entity_id: z.string(),
    data: z.record(z.unknown()).optional(),
  },
  async ({ domain, service, entity_id, data }) => {
    if (!(await ensureHa())) {
      return {
        content: [
          { type: 'text', text: 'Home Assistant not configured (set HA_URL and HA_TOKEN).' },
        ],
      };
    }
    if (entityDomain(entity_id) !== domain) {
      return {
        content: [{ type: 'text', text: `Entity ${entity_id} is not in domain "${domain}".` }],
        isError: true,
      };
    }
    await client.callService({ domain, service, target: { entity_id }, serviceData: data });
    return { content: [{ type: 'text', text: `Called ${domain}.${service} on ${entity_id}.` }] };
  },
);

await server.connect(new StdioServerTransport());

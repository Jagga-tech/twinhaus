import type { ToolDefinition } from './types.js';

/**
 * Runtime the agent's tools act on. The web app implements this by wiring the twin state
 * engine to the Home Assistant bridge — the agent package itself never imports either,
 * which keeps the LLM logic decoupled from the device and geometry layers.
 */
export interface HomeContext {
  /** A snapshot of the home the model can reason over: rooms and the devices in each. */
  describeHome(): Promise<string>;
  /** Devices assigned to a named room, with their live state. */
  getRoomDevices(roomName: string): Promise<string>;
  /** Call a Home Assistant service against one entity, e.g. `light` / `turn_on`. */
  callService(args: {
    domain: string;
    service: string;
    entityId: string;
    data?: Record<string, unknown>;
  }): Promise<string>;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'describe_home',
    description:
      'List every room in the twin and the devices assigned to each, with their current state. Call this first when you need to know what exists in the home.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_room_devices',
    description: 'List the devices in a single room and their live state.',
    inputSchema: {
      type: 'object',
      properties: {
        room_name: { type: 'string', description: 'The name of the room, e.g. "Living Room".' },
      },
      required: ['room_name'],
    },
  },
  {
    name: 'call_service',
    description:
      'Control a device by calling a Home Assistant service on one entity. Examples: domain "light" service "turn_on"; domain "lock" service "lock"; domain "climate" service "set_temperature".',
    inputSchema: {
      type: 'object',
      properties: {
        domain: { type: 'string', description: 'Service domain, e.g. "light", "lock", "switch".' },
        service: { type: 'string', description: 'Service name, e.g. "turn_on", "turn_off".' },
        entity_id: {
          type: 'string',
          description: 'The target entity, e.g. "light.living_room_ceiling".',
        },
        data: {
          type: 'object',
          description: 'Optional service data, e.g. {"brightness_pct": 40} for a light.',
        },
      },
      required: ['domain', 'service', 'entity_id'],
    },
  },
];

/** Dispatch a single tool call against the provided {@link HomeContext}. */
export async function executeTool(
  context: HomeContext,
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  switch (name) {
    case 'describe_home':
      return context.describeHome();
    case 'get_room_devices':
      return context.getRoomDevices(String(input.room_name ?? ''));
    case 'call_service':
      return context.callService({
        domain: String(input.domain),
        service: String(input.service),
        entityId: String(input.entity_id),
        data: input.data as Record<string, unknown> | undefined,
      });
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

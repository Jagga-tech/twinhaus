import type { ToolDefinition } from './types.js';

/**
 * Runtime the agent's tools act on. The web app implements this by wiring the twin state
 * engine to the Home Assistant bridge, the agent package itself never imports either,
 * which keeps the LLM logic decoupled from the device and geometry layers.
 */
export interface HomeContext {
  /** A snapshot of the home the model can reason over: rooms and the devices in each. */
  describeHome(): Promise<string>;
  /**
   * A compact live snapshot (rooms, each placed device's entity id and current state) injected into
   * every request so the model can target devices directly without a `describe_home` round trip.
   * Returns an empty string when nothing is placed or no backend is connected.
   */
  homeSummary(): Promise<string>;
  /** Devices assigned to a named room, with their live state. */
  getRoomDevices(roomName: string): Promise<string>;
  /**
   * List Home Assistant entities, optionally filtered to a domain. Lets the agent discover
   * entity ids beyond what's placed in the twin, needed for routines like turning off every
   * light, activating a scene, or triggering an automation.
   */
  listEntities(domain?: string): Promise<string>;
  /** Per-room power draw in watts, for questions like "which room uses the most energy?". */
  getEnergyByRoom(): Promise<string>;
  /**
   * Scan the live home for noteworthy conditions, locks left unlocked, climate running with a
   * window open, many lights on, high power draw, so the agent can answer "anything I should
   * know?" and proactively flag issues. Read-only; it reports, it doesn't fix anything.
   */
  checkHome(): Promise<string>;
  /**
   * List devices Home Assistant has discovered but not yet configured. Read-only: the agent can
   * tell the user what's new and offer to add it, but adding always requires the user to confirm
   * the config flow in the UI, the agent must never complete a config flow itself.
   */
  listDiscoveredDevices(): Promise<string>;
  /**
   * Search the catalog of smart-home devices Home Assistant can add, so the agent can recommend a
   * real product for a category, protocol, or budget ("suggest a cheap local smart lock"). Read-only
   * and advisory: it never buys or configures anything, the user adds the device through HA.
   */
  searchDeviceCatalog(query?: string): Promise<string>;
  /**
   * Find a device to buy: any product the user names, not just the curated catalog. Returns any
   * matching catalog recommendations (with price and Home Assistant integration) plus real retailer
   * search links so the user can go buy it. Advisory only, Twinhaus never sells or provisions
   * hardware.
   */
  findToBuy(query: string): Promise<string>;
  /**
   * Save a durable preference the user states in passing ("I like the bedroom dim at night", "call
   * the lounge the living room"), so the agent can recall it in future sessions. Returns a short
   * confirmation. Not for one-off commands, only lasting preferences.
   */
  rememberPreference(note: string): Promise<string>;
  /** The saved preferences, injected into context each message so the agent stays personal. */
  recallMemory(): Promise<string>;
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
    name: 'list_entities',
    description:
      'List Home Assistant entities and their state, optionally filtered to a domain (e.g. "light", "scene", "automation"). Use this to find entity ids for routines, turning off all lights, activating a scene, triggering an automation.',
    inputSchema: {
      type: 'object',
      properties: {
        domain: {
          type: 'string',
          description: 'Optional domain filter, e.g. "light", "switch", "scene", "automation".',
        },
      },
    },
  },
  {
    name: 'get_energy_by_room',
    description: 'Report current power draw per room in watts, for energy questions.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'check_home',
    description:
      'Scan the home for things worth flagging, unlocked locks, heating/cooling running with a cover open, many lights left on, unusually high power draw. Call this for "is everything ok?", "anything I should know before bed?", or before confirming the house is buttoned up. Read-only.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_discovered_devices',
    description:
      'List devices Home Assistant has found on the network but not yet configured ("anything new on my network?"). Read-only, you can offer to add them, but the user must confirm setup in the UI. You cannot add or configure devices yourself.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'search_device_catalog',
    description:
      'Search the catalog of smart-home devices Home Assistant can add, to recommend products ("what smart lock should I buy?", "cheap local Zigbee sensor"). Optional query matches brand, category, protocol, or setup. Read-only and advisory, you recommend, the user adds the device through Home Assistant. Never claim to have purchased or configured anything.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Optional search text, e.g. "smart lock", "local zigbee light", "camera under 60".',
        },
      },
    },
  },
  {
    name: 'find_to_buy',
    description:
      'Find a device to buy and where to buy it, for any product the user names ("find me a smart video doorbell", "where can I buy a Zigbee water sensor"). Returns catalog recommendations with prices plus real retailer links. Advisory only; you never purchase anything, you point the user to where to buy.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'What to shop for, e.g. "smart video doorbell", "matter smart plug".',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'remember_preference',
    description:
      'Save a lasting preference the user mentions (a favourite brightness, a nickname for a room, a routine they like) so you can recall it later. Use only for durable preferences, not one-off commands.',
    inputSchema: {
      type: 'object',
      properties: {
        note: { type: 'string', description: 'The preference to remember, in one short sentence.' },
      },
      required: ['note'],
    },
  },
  {
    name: 'call_service',
    description:
      'Control a device by calling a Home Assistant service on one entity. Examples: domain "light" service "turn_on"; domain "lock" service "lock"; domain "climate" service "set_temperature"; domain "scene" service "turn_on"; domain "automation" service "trigger". To run a routine like "turn off everything", list the relevant entities first, then call this once per entity.',
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
    case 'list_entities':
      return context.listEntities(input.domain ? String(input.domain) : undefined);
    case 'get_energy_by_room':
      return context.getEnergyByRoom();
    case 'check_home':
      return context.checkHome();
    case 'find_to_buy':
      return context.findToBuy(String(input.query ?? ''));
    case 'remember_preference':
      return context.rememberPreference(String(input.note ?? ''));
    case 'list_discovered_devices':
      return context.listDiscoveredDevices();
    case 'search_device_catalog':
      return context.searchDeviceCatalog(input.query ? String(input.query) : undefined);
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

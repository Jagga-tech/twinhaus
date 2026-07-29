/** A single Home Assistant entity state, as delivered over the WebSocket API. */
export interface HaEntityState {
  entity_id: string;
  state: string;
  attributes: Record<string, unknown> & {
    friendly_name?: string;
    device_class?: string;
    unit_of_measurement?: string;
  };
  last_changed: string;
  last_updated: string;
  context?: { id: string; parent_id: string | null; user_id: string | null };
}

/** Payload of a `state_changed` event. `old_state` is null when an entity is first created. */
export interface StateChangedEvent {
  entity_id: string;
  new_state: HaEntityState | null;
  old_state: HaEntityState | null;
}

/** Target for a service call — any subset is valid. */
export interface ServiceTarget {
  entity_id?: string | string[];
  device_id?: string | string[];
  area_id?: string | string[];
}

export interface CallServiceOptions {
  domain: string;
  service: string;
  serviceData?: Record<string, unknown>;
  target?: ServiceTarget;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'authenticating' | 'connected';

export interface HaConnectionConfig {
  /** Base URL of the Home Assistant instance, e.g. `http://homeassistant.local:8123`. */
  url: string;
  /** A long-lived access token (Profile → Long-Lived Access Tokens in HA). */
  token: string;
}

/** The `entity_id` prefix identifies the integration domain, e.g. `light`, `lock`, `sensor`. */
export function entityDomain(entityId: string): string {
  return entityId.split('.', 1)[0];
}

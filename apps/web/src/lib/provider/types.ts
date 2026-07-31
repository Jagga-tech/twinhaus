import type {
  CallServiceOptions,
  ConnectionStatus,
  HaEntityState,
  StateChangedEvent,
  RawArea,
  RawDeviceRegistryEntry,
  RawEntityRegistryEntry,
  RawFloor,
} from '@twinhaus/ha-bridge';

export type { CallServiceOptions, ConnectionStatus, StateChangedEvent };

/**
 * The normalized entity model every backend speaks. It is structurally Home Assistant's
 * `{ entity_id, state, attributes }`, chosen because it's already generic, but nothing binds it
 * to HA: a Demo, MQTT, or Matter backend produces the same shape, so the twin, agent, energy,
 * and positioning layers never learn which backend they're talking to.
 */
export type EntityState = HaEntityState;

/**
 * Config passed to {@link DeviceProvider.connect}. Each backend reads the fields it needs, HA uses
 * `url` + `token`; an MQTT backend reads `url` (broker WS URL) and optional credentials; Demo reads
 * nothing. Extra keys are allowed so a backend can carry its own settings.
 */
export interface ProviderConfig {
  url?: string;
  token?: string;
  username?: string;
  password?: string;
  [key: string]: unknown;
}

/**
 * Optional capability: a backend that exposes an area/floor/device registry, letting Twinhaus
 * auto-generate the floor plan (home-scan). Only Home Assistant offers this today; a provider
 * without it simply omits `registry`, and the scan UI hides itself.
 */
export interface RegistrySource {
  listFloors(): Promise<RawFloor[]>;
  listAreas(): Promise<RawArea[]>;
  listDeviceRegistry(): Promise<RawDeviceRegistryEntry[]>;
  listEntityRegistry(): Promise<RawEntityRegistryEntry[]>;
}

/**
 * A device backend Twinhaus can drive. Home Assistant is one implementation; Demo, MQTT, and
 * Matter are others. The app only ever talks to this interface, so "freedom from HA" is just a
 * matter of selecting a different provider, no other layer changes.
 *
 * Twinhaus still never touches hardware directly, the provider is the boundary. HA and MQTT both
 * front real device stacks; Demo fronts a simulation; Matter fronts a local commissioning service.
 */
export interface DeviceProvider {
  /** Stable id, e.g. `homeassistant`, `demo`, `mqtt`, `matter`. */
  readonly id: string;
  /** Human label for the backend picker. */
  readonly label: string;
  /** True when the backend needs no external hub or hardware at all (Demo). */
  readonly standalone: boolean;
  /** One-line note for the picker: what this backend connects to and what it needs. */
  readonly summary: string;

  connect(config: ProviderConfig): Promise<void>;
  disconnect(): void;
  getStatus(): ConnectionStatus;

  onStatusChange(listener: (status: ConnectionStatus) => void): () => void;
  onStateChanged(listener: (event: StateChangedEvent) => void): () => void;
  onReconnected(listener: () => void): () => void;

  getStates(): Promise<EntityState[]>;
  callService(options: CallServiceOptions): Promise<void>;

  /** Present only when the backend can enumerate a room/floor registry for auto home-scan. */
  registry?: RegistrySource;
}

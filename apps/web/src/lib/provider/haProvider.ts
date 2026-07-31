import { HaClient } from '@twinhaus/ha-bridge';
import type {
  CallServiceOptions,
  ConnectionStatus,
  DeviceProvider,
  EntityState,
  ProviderConfig,
  RegistrySource,
  StateChangedEvent,
} from './types.js';

/**
 * The Home Assistant backend: a thin {@link DeviceProvider} adapter over the existing
 * {@link HaClient}, which already handles the auth handshake, state subscription, auto-reconnect,
 * and service calls. HA gives the widest device coverage (its whole integration ecosystem), so it
 * stays the default backend, it's just no longer the *only* one the app knows how to talk to.
 */
export class HomeAssistantProvider implements DeviceProvider {
  readonly id = 'homeassistant';
  readonly label = 'Home Assistant';
  readonly standalone = false;
  readonly summary = 'Connect your HA instance (URL + token). Widest device coverage.';
  readonly registry: RegistrySource;

  constructor(private readonly client: HaClient = new HaClient()) {
    this.registry = {
      listFloors: () => client.listFloors(),
      listAreas: () => client.listAreas(),
      listDeviceRegistry: () => client.listDeviceRegistry(),
      listEntityRegistry: () => client.listEntityRegistry(),
    };
  }

  /** The underlying client, for the HA-only config-flow discovery seam that has no provider analog. */
  get haClient(): HaClient {
    return this.client;
  }

  async connect(config: ProviderConfig): Promise<void> {
    if (!config.url || !config.token) {
      throw new Error('Home Assistant needs a URL and an access token.');
    }
    return this.client.connect({ url: config.url, token: config.token });
  }

  disconnect(): void {
    this.client.disconnect();
  }

  getStatus(): ConnectionStatus {
    return this.client.getStatus();
  }

  onStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    return this.client.onStatusChange(listener);
  }

  onStateChanged(listener: (event: StateChangedEvent) => void): () => void {
    return this.client.onStateChanged(listener);
  }

  onReconnected(listener: () => void): () => void {
    return this.client.onReconnected(listener);
  }

  getStates(): Promise<EntityState[]> {
    return this.client.getStates();
  }

  callService(options: CallServiceOptions): Promise<void> {
    return this.client.callService(options);
  }
}

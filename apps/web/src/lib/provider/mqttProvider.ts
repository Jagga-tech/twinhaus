import type {
  CallServiceOptions,
  ConnectionStatus,
  DeviceProvider,
  EntityState,
  ProviderConfig,
  StateChangedEvent,
} from './types.js';
import type { MqttMessage, MqttTransport } from './mqttTransport.js';
import {
  Z2M_BASE,
  Z2M_DEVICES_TOPIC,
  parseDeviceList,
  serviceToZ2mSet,
  z2mToEntityState,
  type Z2mDevice,
} from './z2m.js';

/**
 * A Home-Assistant-free live backend that speaks MQTT directly to a zigbee2mqtt bridge. The
 * browser connects to the broker over WebSocket; z2m publishes device state and accepts commands.
 * This gives real control of a Zigbee network with just a broker, no HA.
 *
 * The transport is injected so the zigbee2mqtt translation is fully testable without a broker; the
 * default {@link createMqttTransport} adapter wraps mqtt.js.
 */
export class MqttProvider implements DeviceProvider {
  readonly id = 'mqtt';
  readonly label = 'MQTT (zigbee2mqtt)';
  readonly standalone = false;
  readonly summary = 'Talk to a zigbee2mqtt broker directly over WebSocket, no Home Assistant.';

  private status: ConnectionStatus = 'disconnected';
  private readonly statusListeners = new Set<(s: ConnectionStatus) => void>();
  private readonly stateListeners = new Set<(e: StateChangedEvent) => void>();
  private readonly devicesByName = new Map<string, Z2mDevice>();
  private readonly devicesById = new Map<string, Z2mDevice>();
  private readonly states = new Map<string, EntityState>();

  constructor(private readonly transport: MqttTransport) {
    transport.onMessage((message) => this.handleMessage(message));
    transport.onClose(() => this.setStatus('reconnecting'));
  }

  async connect(config: ProviderConfig): Promise<void> {
    if (!config.url) {
      throw new Error('MQTT needs a broker WebSocket URL, e.g. ws://broker:9001.');
    }
    this.setStatus('connecting');
    try {
      await this.transport.connect(config.url, {
        username: config.username,
        password: config.password,
      });
    } catch (err) {
      this.setStatus('disconnected');
      throw err;
    }
    // Device roster (retained) plus every device's state topic.
    this.transport.subscribe(Z2M_DEVICES_TOPIC);
    this.transport.subscribe(`${Z2M_BASE}/#`);
    this.setStatus('connected');
  }

  disconnect(): void {
    this.transport.end();
    this.devicesByName.clear();
    this.devicesById.clear();
    this.states.clear();
    this.setStatus('disconnected');
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  onStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  onStateChanged(listener: (event: StateChangedEvent) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  onReconnected(): () => void {
    // mqtt.js reconnects under the transport; state re-arrives via retained topics.
    return () => undefined;
  }

  async getStates(): Promise<EntityState[]> {
    return [...this.states.values()];
  }

  async callService(options: CallServiceOptions): Promise<void> {
    const target = options.target?.entity_id;
    const ids = Array.isArray(target) ? target : target ? [target] : [];
    for (const id of ids) {
      const device = this.devicesById.get(id);
      if (!device) continue;
      const command = serviceToZ2mSet(device, options);
      if (command) this.transport.publish(command.topic, command.payload);
    }
  }

  private handleMessage(message: MqttMessage): void {
    if (message.topic === Z2M_DEVICES_TOPIC) {
      this.ingestDeviceList(message.payload);
      return;
    }
    if (!message.topic.startsWith(`${Z2M_BASE}/`)) return;

    const remainder = message.topic.slice(Z2M_BASE.length + 1);
    // Only bare device-state topics; skip bridge/*, and /set /get /availability sub-topics.
    if (remainder.startsWith('bridge/')) return;
    if (/\/(set|get|availability)$/.test(remainder)) return;

    const device = this.devicesByName.get(remainder);
    if (!device) return;
    const state = z2mToEntityState(device, message.payload);
    if (state) this.commit(state);
  }

  private ingestDeviceList(payload: string): void {
    for (const device of parseDeviceList(payload)) {
      this.devicesByName.set(device.friendlyName, device);
      this.devicesById.set(device.entityId, device);
    }
  }

  private commit(next: EntityState): void {
    const old = this.states.get(next.entity_id) ?? null;
    this.states.set(next.entity_id, next);
    for (const listener of this.stateListeners) {
      listener({ entity_id: next.entity_id, new_state: next, old_state: old });
    }
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.statusListeners) listener(status);
  }
}

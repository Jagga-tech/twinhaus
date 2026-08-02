import type {
  CallServiceOptions,
  ConnectionStatus,
  DeviceProvider,
  EntityState,
  ProviderConfig,
  StateChangedEvent,
} from './types.js';
import type { CompanionSocket } from './companionSocket.js';

/**
 * The Matter backend. A browser cannot commission or drive Matter devices directly, that needs a
 * native controller (BLE/Thread/mDNS, certificates, PASE/CASE). So Twinhaus talks to a small local
 * companion service that runs the Matter fabric (e.g. python-matter-server behind a thin adapter)
 * and speaks this JSON-over-WebSocket contract:
 *
 *   browser to service:  { type: 'subscribe' }
 *                       { type: 'command', domain, service, entity_id, data }
 *   service to browser:  { type: 'snapshot', states: EntityState[] }
 *                       { type: 'event', state: EntityState }
 *
 * Twinhaus ships this browser half; the service half is the deployment's responsibility. See
 * docs/BACKENDS.md. Until such a service is running, selecting Matter connects to nothing, the
 * summary and connect error make that explicit rather than pretending to control hardware.
 */
export class MatterProvider implements DeviceProvider {
  readonly id = 'matter';
  readonly label = 'Matter (companion service)';
  readonly standalone = false;
  readonly summary = 'Drive Matter devices via a local companion service. No Home Assistant.';

  private status: ConnectionStatus = 'disconnected';
  private readonly statusListeners = new Set<(s: ConnectionStatus) => void>();
  private readonly stateListeners = new Set<(e: StateChangedEvent) => void>();
  private readonly states = new Map<string, EntityState>();

  constructor(private readonly socket: CompanionSocket) {
    socket.onMessage((message) => this.handleMessage(message));
    socket.onClose(() => this.setStatus('reconnecting'));
  }

  async connect(config: ProviderConfig): Promise<void> {
    if (!config.url) {
      throw new Error('Matter needs the companion service URL, e.g. ws://localhost:5580.');
    }
    this.setStatus('connecting');
    try {
      await this.socket.connect(config.url);
    } catch (err) {
      this.setStatus('disconnected');
      throw err;
    }
    this.socket.send({ type: 'subscribe' });
    this.setStatus('connected');
  }

  disconnect(): void {
    this.socket.close();
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
    return () => undefined;
  }

  async getStates(): Promise<EntityState[]> {
    return [...this.states.values()];
  }

  async callService(options: CallServiceOptions): Promise<void> {
    const target = options.target?.entity_id;
    const ids = Array.isArray(target) ? target : target ? [target] : [];
    for (const id of ids) {
      this.socket.send({
        type: 'command',
        domain: options.domain,
        service: options.service,
        entity_id: id,
        data: options.serviceData ?? {},
      });
    }
  }

  private handleMessage(message: unknown): void {
    if (!message || typeof message !== 'object') return;
    const msg = message as { type?: string; states?: EntityState[]; state?: EntityState };

    if (msg.type === 'snapshot' && Array.isArray(msg.states)) {
      for (const state of msg.states) this.commit(state);
    } else if (msg.type === 'event' && msg.state) {
      this.commit(msg.state);
    }
  }

  private commit(next: EntityState): void {
    if (!next.entity_id) return;
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

import type {
  CallServiceOptions,
  ConnectionStatus,
  HaConnectionConfig,
  HaEntityState,
  StateChangedEvent,
} from './types.js';

type StateListener = (event: StateChangedEvent) => void;
type StatusListener = (status: ConnectionStatus) => void;

interface PendingCommand {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

/**
 * Minimal Home Assistant WebSocket client.
 *
 * Implements the auth handshake, `get_states`, `subscribe_events` (state_changed),
 * and `call_service`. Twinhaus never talks to hardware directly — this bridge is the
 * only path to devices, and Home Assistant owns every integration behind it.
 *
 * @see https://developers.home-assistant.io/docs/api/websocket
 */
export class HaClient {
  private socket: WebSocket | null = null;
  private config: HaConnectionConfig | null = null;
  private messageId = 1;
  private status: ConnectionStatus = 'disconnected';
  private readonly pending = new Map<number, PendingCommand>();
  private readonly stateListeners = new Set<StateListener>();
  private readonly statusListeners = new Set<StatusListener>();
  private closedByUser = false;

  getStatus(): ConnectionStatus {
    return this.status;
  }

  onStateChanged(listener: StateListener): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /** Connect, authenticate, and subscribe to `state_changed`. Resolves once authenticated. */
  connect(config: HaConnectionConfig): Promise<void> {
    this.disconnect();
    this.config = config;
    this.closedByUser = false;

    return new Promise((resolve, reject) => {
      const wsUrl = toWebSocketUrl(config.url);
      this.setStatus('connecting');

      let socket: WebSocket;
      try {
        socket = new WebSocket(wsUrl);
      } catch (err) {
        this.setStatus('disconnected');
        reject(err instanceof Error ? err : new Error(String(err)));
        return;
      }
      this.socket = socket;

      socket.addEventListener('message', (event) => {
        this.handleMessage(JSON.parse(event.data as string), resolve, reject);
      });

      socket.addEventListener('error', () => {
        if (this.status !== 'connected') {
          reject(new Error(`Unable to reach Home Assistant at ${config.url}`));
        }
      });

      socket.addEventListener('close', () => {
        this.setStatus('disconnected');
        this.failPending(new Error('Connection to Home Assistant closed'));
        if (!this.closedByUser) {
          reject(new Error('Connection to Home Assistant closed before authentication'));
        }
      });
    });
  }

  disconnect(): void {
    this.closedByUser = true;
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.failPending(new Error('Client disconnected'));
    this.setStatus('disconnected');
  }

  /** Fetch a snapshot of every entity's current state. */
  async getStates(): Promise<HaEntityState[]> {
    const result = await this.sendCommand({ type: 'get_states' });
    return result as HaEntityState[];
  }

  /** Call a Home Assistant service, e.g. `light.turn_on` targeting an entity. */
  async callService(options: CallServiceOptions): Promise<void> {
    await this.sendCommand({
      type: 'call_service',
      domain: options.domain,
      service: options.service,
      service_data: options.serviceData,
      target: options.target,
    });
  }

  private handleMessage(
    message: Record<string, unknown>,
    resolveConnect: () => void,
    rejectConnect: (reason: Error) => void,
  ): void {
    switch (message.type) {
      case 'auth_required':
        this.setStatus('authenticating');
        this.rawSend({ type: 'auth', access_token: this.config?.token });
        break;

      case 'auth_ok':
        this.setStatus('connected');
        this.rawSend({
          id: this.messageId++,
          type: 'subscribe_events',
          event_type: 'state_changed',
        });
        resolveConnect();
        break;

      case 'auth_invalid':
        this.closedByUser = true;
        this.socket?.close();
        rejectConnect(new Error('Home Assistant rejected the access token'));
        break;

      case 'result': {
        const id = message.id as number;
        const pending = this.pending.get(id);
        if (!pending) break;
        this.pending.delete(id);
        if (message.success) {
          pending.resolve(message.result);
        } else {
          const error = message.error as { message?: string } | undefined;
          pending.reject(new Error(error?.message ?? 'Home Assistant command failed'));
        }
        break;
      }

      case 'event': {
        const event = message.event as { event_type: string; data: StateChangedEvent } | undefined;
        if (event?.event_type === 'state_changed') {
          for (const listener of this.stateListeners) listener(event.data);
        }
        break;
      }
    }
  }

  private sendCommand(payload: Record<string, unknown>): Promise<unknown> {
    if (!this.socket || this.status !== 'connected') {
      return Promise.reject(new Error('Not connected to Home Assistant'));
    }
    const id = this.messageId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.rawSend({ id, ...payload });
    });
  }

  private rawSend(payload: Record<string, unknown>): void {
    this.socket?.send(JSON.stringify(payload));
  }

  private failPending(error: Error): void {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.statusListeners) listener(status);
  }
}

/** Convert an `http(s)://host` base URL into the `ws(s)://host/api/websocket` endpoint. */
function toWebSocketUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, '');
  const wsBase = trimmed.replace(/^http/i, 'ws');
  return `${wsBase}/api/websocket`;
}

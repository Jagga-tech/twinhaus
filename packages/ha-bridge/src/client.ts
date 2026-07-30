import { backoffDelay, type BackoffOptions } from './backoff.js';
import type {
  CallServiceOptions,
  ConnectionStatus,
  HaConnectionConfig,
  HaEntityState,
  RawArea,
  RawConfigFlow,
  RawConfigFlowStep,
  RawDeviceRegistryEntry,
  RawEntityRegistryEntry,
  RawFloor,
  StateChangedEvent,
} from './types.js';

type StateListener = (event: StateChangedEvent) => void;
type StatusListener = (status: ConnectionStatus) => void;
type EventListener = (event: unknown) => void;
type ReconnectListener = () => void;

interface PendingCommand {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
}

/** A live WebSocket subscription, kept so it can be re-established after a reconnect. */
interface Subscription {
  id: number;
  payload: Record<string, unknown>;
  onEvent: EventListener;
}

/** A command issued while reconnecting, held until the connection is back (or it times out). */
interface QueuedCommand {
  payload: Record<string, unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** The subset of the WebSocket API the client needs; injectable so reconnection is testable. */
export interface HaSocket {
  send(data: string): void;
  close(): void;
  addEventListener(type: 'message', handler: (event: { data: string }) => void): void;
  addEventListener(type: 'open' | 'close' | 'error', handler: () => void): void;
}

export interface ReconnectOptions extends BackoffOptions {
  /** Auto-reconnect after an unexpected drop. Default true. */
  enabled?: boolean;
  /** Give up after this many attempts. Default Infinity, keep trying until told to stop. */
  maxAttempts?: number;
  /** Injectable randomness for deterministic backoff in tests. */
  random?: () => number;
}

export interface HaClientOptions {
  /** Override socket creation (tests inject a fake; the browser uses `WebSocket`). */
  socketFactory?: (url: string) => HaSocket;
  reconnect?: ReconnectOptions;
  /** Hold commands issued mid-reconnect and flush them once reconnected. Default true. */
  queueWhileReconnecting?: boolean;
  /** Reject a queued command if it can't be sent within this window (ms). Default 15000. */
  commandTimeoutMs?: number;
  setTimeoutFn?: (callback: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimeoutFn?: (handle: ReturnType<typeof setTimeout>) => void;
}

/**
 * Minimal Home Assistant WebSocket client.
 *
 * Implements the auth handshake, `get_states`, `subscribe_events` (state_changed), and
 * `call_service`. When a live connection drops unexpectedly it auto-reconnects with exponential
 * backoff, re-authenticates, re-subscribes to state_changed and any active subscriptions, and
 * fires `onReconnected` so the app can reload a fresh snapshot, the twin heals itself instead of
 * going stale. Twinhaus never talks to hardware directly; this bridge is the only path to devices.
 *
 * @see https://developers.home-assistant.io/docs/api/websocket
 */
export class HaClient {
  private socket: HaSocket | null = null;
  private config: HaConnectionConfig | null = null;
  private messageId = 1;
  private status: ConnectionStatus = 'disconnected';
  private readonly pending = new Map<number, PendingCommand>();
  private readonly subscriptions = new Map<number, EventListener>();
  private readonly activeSubscriptions = new Set<Subscription>();
  private readonly stateListeners = new Set<StateListener>();
  private readonly statusListeners = new Set<StatusListener>();
  private readonly reconnectListeners = new Set<ReconnectListener>();

  private readonly commandQueue = new Set<QueuedCommand>();
  private closedByUser = false;
  private everConnected = false;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectResolve: (() => void) | null = null;
  private connectReject: ((reason: Error) => void) | null = null;

  private readonly queueWhileReconnecting: boolean;
  private readonly commandTimeoutMs: number;
  private readonly socketFactory: (url: string) => HaSocket;
  private readonly reconnectOptions: {
    enabled: boolean;
    maxAttempts: number;
    random: () => number;
  } & BackoffOptions;
  private readonly setTimeoutFn: (
    callback: () => void,
    ms: number,
  ) => ReturnType<typeof setTimeout>;
  private readonly clearTimeoutFn: (handle: ReturnType<typeof setTimeout>) => void;

  constructor(options: HaClientOptions = {}) {
    this.queueWhileReconnecting = options.queueWhileReconnecting ?? true;
    this.commandTimeoutMs = options.commandTimeoutMs ?? 15000;
    this.socketFactory =
      options.socketFactory ?? ((url) => new WebSocket(url) as unknown as HaSocket);
    this.reconnectOptions = {
      enabled: options.reconnect?.enabled ?? true,
      maxAttempts: options.reconnect?.maxAttempts ?? Number.POSITIVE_INFINITY,
      random: options.reconnect?.random ?? Math.random,
      baseMs: options.reconnect?.baseMs,
      maxMs: options.reconnect?.maxMs,
      jitter: options.reconnect?.jitter,
    };
    this.setTimeoutFn = options.setTimeoutFn ?? ((cb, ms) => setTimeout(cb, ms));
    this.clearTimeoutFn = options.clearTimeoutFn ?? ((handle) => clearTimeout(handle));
  }

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

  /**
   * Fires after the connection is re-established following an unexpected drop. The app reloads a
   * full state snapshot here, since events missed while offline left the live mirror stale.
   */
  onReconnected(listener: ReconnectListener): () => void {
    this.reconnectListeners.add(listener);
    return () => this.reconnectListeners.delete(listener);
  }

  /** Connect, authenticate, and subscribe to `state_changed`. Resolves once authenticated. */
  connect(config: HaConnectionConfig): Promise<void> {
    this.disconnect();
    this.config = config;
    this.closedByUser = false;
    this.everConnected = false;
    this.reconnectAttempts = 0;

    return new Promise((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;
      this.openSocket();
    });
  }

  disconnect(): void {
    this.closedByUser = true;
    this.clearReconnectTimer();
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.activeSubscriptions.clear();
    this.failQueuedCommands(new Error('Client disconnected'));
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

  private openSocket(): void {
    if (!this.config) return;
    const wsUrl = toWebSocketUrl(this.config.url);
    this.setStatus(this.everConnected ? 'reconnecting' : 'connecting');

    let socket: HaSocket;
    try {
      socket = this.socketFactory(wsUrl);
    } catch (err) {
      if (this.everConnected) {
        this.scheduleReconnect();
      } else {
        this.setStatus('disconnected');
        this.rejectConnect(err instanceof Error ? err : new Error(String(err)));
      }
      return;
    }
    this.socket = socket;

    socket.addEventListener('message', (event) => {
      this.handleMessage(JSON.parse(event.data) as Record<string, unknown>);
    });
    socket.addEventListener('error', () => {
      if (this.status !== 'connected' && !this.everConnected) {
        this.rejectConnect(new Error(`Unable to reach Home Assistant at ${this.config?.url}`));
      }
    });
    socket.addEventListener('close', () => this.handleClose());
  }

  private handleMessage(message: Record<string, unknown>): void {
    switch (message.type) {
      case 'auth_required':
        this.setStatus('authenticating');
        this.rawSend({ type: 'auth', access_token: this.config?.token });
        break;

      case 'auth_ok':
        this.onAuthenticated();
        break;

      case 'auth_invalid':
        this.closedByUser = true;
        this.clearReconnectTimer();
        this.socket?.close();
        this.rejectConnect(new Error('Home Assistant rejected the access token'));
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
        const subscriber = this.subscriptions.get(message.id as number);
        if (subscriber) {
          subscriber(message.event);
          break;
        }
        const event = message.event as { event_type: string; data: StateChangedEvent } | undefined;
        if (event?.event_type === 'state_changed') {
          for (const listener of this.stateListeners) listener(event.data);
        }
        break;
      }
    }
  }

  private onAuthenticated(): void {
    const wasReconnect = this.everConnected;
    this.everConnected = true;
    this.reconnectAttempts = 0;
    this.setStatus('connected');

    this.rawSend({
      id: this.messageId++,
      type: 'subscribe_events',
      event_type: 'state_changed',
    });

    if (wasReconnect) {
      this.reestablishSubscriptions();
      this.flushCommandQueue();
      for (const listener of this.reconnectListeners) listener();
    }

    this.connectResolve?.();
    this.connectResolve = null;
    this.connectReject = null;
  }

  private handleClose(): void {
    this.failPending(new Error('Connection to Home Assistant closed'));
    this.subscriptions.clear();
    this.socket = null;

    if (this.closedByUser) {
      this.setStatus('disconnected');
      return;
    }
    if (!this.everConnected) {
      this.setStatus('disconnected');
      this.rejectConnect(new Error('Connection to Home Assistant closed before authentication'));
      return;
    }
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (
      !this.reconnectOptions.enabled ||
      this.reconnectAttempts >= this.reconnectOptions.maxAttempts
    ) {
      this.failQueuedCommands(new Error('Home Assistant reconnection gave up'));
      this.setStatus('disconnected');
      return;
    }
    this.setStatus('reconnecting');
    const delay = backoffDelay(
      this.reconnectAttempts,
      this.reconnectOptions,
      this.reconnectOptions.random,
    );
    this.reconnectAttempts += 1;
    this.clearReconnectTimer();
    this.reconnectTimer = this.setTimeoutFn(() => {
      this.reconnectTimer = null;
      this.openSocket();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      this.clearTimeoutFn(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private rejectConnect(error: Error): void {
    this.connectReject?.(error);
    this.connectResolve = null;
    this.connectReject = null;
  }

  /**
   * Subscribe to a Home Assistant WebSocket subscription command. `onEvent` fires for each
   * streamed event; the returned function cancels the subscription. Subscriptions are tracked so
   * they survive a reconnect, a dropped connection re-establishes them automatically.
   */
  async subscribe(payload: Record<string, unknown>, onEvent: EventListener): Promise<() => void> {
    if (!this.socket || this.status !== 'connected') {
      throw new Error('Not connected to Home Assistant');
    }
    const id = this.messageId++;
    const subscription: Subscription = { id, payload, onEvent };
    this.activeSubscriptions.add(subscription);
    this.subscriptions.set(id, onEvent);
    await new Promise<void>((resolve, reject) => {
      this.pending.set(id, { resolve: () => resolve(), reject });
      this.rawSend({ id, ...payload });
    });
    return () => {
      this.activeSubscriptions.delete(subscription);
      this.subscriptions.delete(subscription.id);
      this.rawSend({
        id: this.messageId++,
        type: 'unsubscribe_events',
        subscription: subscription.id,
      });
    };
  }

  /** Re-send every active subscription after a reconnect; the server assigns fresh ids. */
  private reestablishSubscriptions(): void {
    for (const subscription of this.activeSubscriptions) {
      const id = this.messageId++;
      subscription.id = id;
      this.subscriptions.set(id, subscription.onEvent);
      this.rawSend({ id, ...subscription.payload });
    }
  }

  // --- Registries (auto-scan the home: areas + device/entity assignments) ---
  // Home Assistant already knows the user's rooms and which device lives in which, Twinhaus reads
  // these to generate a floor plan and place devices without the user drawing anything.

  /** List the floors (storeys) the user has defined in Home Assistant. */
  async listFloors(): Promise<RawFloor[]> {
    return (await this.sendCommand({ type: 'config/floor_registry/list' })) as RawFloor[];
  }

  /** List the areas (rooms) the user has defined in Home Assistant. */
  async listAreas(): Promise<RawArea[]> {
    return (await this.sendCommand({ type: 'config/area_registry/list' })) as RawArea[];
  }

  /** List device-registry entries, each with the area it's assigned to. */
  async listDeviceRegistry(): Promise<RawDeviceRegistryEntry[]> {
    return (await this.sendCommand({
      type: 'config/device_registry/list',
    })) as RawDeviceRegistryEntry[];
  }

  /** List entity-registry entries, mapping each entity to its device and/or area. */
  async listEntityRegistry(): Promise<RawEntityRegistryEntry[]> {
    return (await this.sendCommand({
      type: 'config/entity_registry/list',
    })) as RawEntityRegistryEntry[];
  }

  // --- Config flows (discovered-but-unconfigured devices) ---
  // Home Assistant is the discovery layer (mDNS/SSDP/DHCP/Bluetooth). Flows are stepped over
  // the REST API; a WebSocket subscription signals when the in-progress set changes.

  /** List config flows Home Assistant has started but not yet finished. */
  listConfigFlows(): Promise<RawConfigFlow[]> {
    return this.rest<RawConfigFlow[]>('GET', '/api/config/config_entries/flow');
  }

  /** Subscribe to changes in the in-progress flow set; `onChange` fires on any add/remove. */
  subscribeConfigFlows(onChange: () => void): Promise<() => void> {
    return this.subscribe({ type: 'config_entries/flow/subscribe' }, () => onChange());
  }

  /** Fetch the current step of a flow (its form schema, if it needs input). */
  getConfigFlow(flowId: string): Promise<RawConfigFlowStep> {
    return this.rest<RawConfigFlowStep>('GET', `/api/config/config_entries/flow/${flowId}`);
  }

  /** Advance a flow by submitting user input; returns the next step or the created entry. */
  stepConfigFlow(flowId: string, input: Record<string, unknown>): Promise<RawConfigFlowStep> {
    return this.rest<RawConfigFlowStep>('POST', `/api/config/config_entries/flow/${flowId}`, input);
  }

  /** Abort a flow the user chose not to complete. */
  async abortConfigFlow(flowId: string): Promise<void> {
    await this.rest<unknown>('DELETE', `/api/config/config_entries/flow/${flowId}`);
  }

  private async rest<T>(method: string, path: string, body?: unknown): Promise<T> {
    if (!this.config) throw new Error('Not connected to Home Assistant');
    const base = this.config.url.trim().replace(/\/+$/, '');
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${this.config.token}`,
        'content-type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok) {
      throw new Error(`Home Assistant ${method} ${path} failed (${response.status})`);
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  private sendCommand(payload: Record<string, unknown>): Promise<unknown> {
    if (this.socket && this.status === 'connected') {
      const id = this.messageId++;
      return new Promise((resolve, reject) => {
        this.pending.set(id, { resolve, reject });
        this.rawSend({ id, ...payload });
      });
    }
    // Mid-reconnect: hold the command and flush it once we're back, rather than failing outright.
    if (this.queueWhileReconnecting && !this.closedByUser && this.isReconnecting()) {
      return this.enqueueCommand(payload);
    }
    return Promise.reject(new Error('Not connected to Home Assistant'));
  }

  private isReconnecting(): boolean {
    return (
      this.reconnectOptions.enabled &&
      this.everConnected &&
      (this.status === 'reconnecting' ||
        this.status === 'connecting' ||
        this.status === 'authenticating')
    );
  }

  private enqueueCommand(payload: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const command: QueuedCommand = {
        payload,
        resolve,
        reject,
        timer: this.setTimeoutFn(() => {
          this.commandQueue.delete(command);
          reject(new Error('Home Assistant command timed out while reconnecting'));
        }, this.commandTimeoutMs),
      };
      this.commandQueue.add(command);
    });
  }

  /** Send every queued command on a freshly authenticated socket, wiring each to a pending result. */
  private flushCommandQueue(): void {
    const queued = [...this.commandQueue];
    this.commandQueue.clear();
    for (const command of queued) {
      this.clearTimeoutFn(command.timer);
      const id = this.messageId++;
      this.pending.set(id, { resolve: command.resolve, reject: command.reject });
      this.rawSend({ id, ...command.payload });
    }
  }

  private failQueuedCommands(error: Error): void {
    for (const command of this.commandQueue) {
      this.clearTimeoutFn(command.timer);
      command.reject(error);
    }
    this.commandQueue.clear();
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

import { describe, expect, it } from 'vitest';
import { HaClient, type HaSocket } from './client.js';

type Handler = (event: { data: string }) => void;

/** A scriptable stand-in for the browser WebSocket, so reconnection is testable without a network. */
class FakeSocket implements HaSocket {
  readonly sent: Array<Record<string, unknown>> = [];
  private readonly handlers: Record<string, Handler[]> = {
    message: [],
    open: [],
    close: [],
    error: [],
  };

  addEventListener(type: 'message', handler: (event: { data: string }) => void): void;
  addEventListener(type: 'open' | 'close' | 'error', handler: () => void): void;
  addEventListener(type: string, handler: (event: { data: string }) => void): void {
    this.handlers[type].push(handler);
  }

  send(data: string): void {
    this.sent.push(JSON.parse(data));
  }

  close(): void {
    // The browser's close() only requests a close; the close event is delivered separately.
  }

  emitMessage(message: Record<string, unknown>): void {
    for (const handler of this.handlers.message) handler({ data: JSON.stringify(message) });
  }

  drop(): void {
    for (const handler of this.handlers.close) handler({ data: '' });
  }
}

interface Harness {
  client: HaClient;
  sockets: FakeSocket[];
  fireTimer: () => void;
  hasTimer: () => boolean;
}

function harness(options: { maxAttempts?: number } = {}): Harness {
  const sockets: FakeSocket[] = [];
  let timer: (() => void) | null = null;
  const client = new HaClient({
    socketFactory: () => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    },
    setTimeoutFn: (cb) => {
      timer = cb;
      return 0 as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeoutFn: () => {
      timer = null;
    },
    reconnect: { enabled: true, random: () => 0, baseMs: 10, ...options },
  });
  return {
    client,
    sockets,
    fireTimer: () => {
      const cb = timer;
      timer = null;
      cb?.();
    },
    hasTimer: () => timer !== null,
  };
}

function handshake(socket: FakeSocket): void {
  socket.emitMessage({ type: 'auth_required' });
  socket.emitMessage({ type: 'auth_ok' });
}

async function connect(h: Harness): Promise<void> {
  const promise = h.client.connect({ url: 'http://ha.local:8123', token: 't' });
  handshake(h.sockets[0]);
  await promise;
}

describe('HaClient reconnection', () => {
  it('auto-reconnects after an unexpected drop and heals the connection', async () => {
    const h = harness();
    await connect(h);
    expect(h.client.getStatus()).toBe('connected');

    let reconnected = 0;
    h.client.onReconnected(() => (reconnected += 1));

    h.sockets[0].drop();
    expect(h.client.getStatus()).toBe('reconnecting');
    expect(h.hasTimer()).toBe(true);

    h.fireTimer();
    expect(h.sockets).toHaveLength(2);
    handshake(h.sockets[1]);

    expect(h.client.getStatus()).toBe('connected');
    expect(reconnected).toBe(1);
  });

  it('re-establishes active subscriptions on reconnect', async () => {
    const h = harness();
    await connect(h);

    const subPromise = h.client.subscribe(
      { type: 'config_entries/flow/subscribe' },
      () => undefined,
    );
    const sub = h.sockets[0].sent.find((m) => m.type === 'config_entries/flow/subscribe');
    h.sockets[0].emitMessage({ type: 'result', id: sub!.id, success: true });
    await subPromise;

    h.sockets[0].drop();
    h.fireTimer();
    handshake(h.sockets[1]);

    expect(h.sockets[1].sent.some((m) => m.type === 'config_entries/flow/subscribe')).toBe(true);
  });

  it('does not reconnect after the user disconnects', async () => {
    const h = harness();
    await connect(h);

    h.client.disconnect();
    expect(h.client.getStatus()).toBe('disconnected');

    h.sockets[0].drop();
    expect(h.client.getStatus()).toBe('disconnected');
    expect(h.hasTimer()).toBe(false);
  });

  it('gives up and reports disconnected after maxAttempts', async () => {
    const h = harness({ maxAttempts: 2 });
    await connect(h);

    h.sockets[0].drop(); // attempt 1 scheduled
    h.fireTimer();
    h.sockets[1].drop(); // attempt 2 scheduled
    h.fireTimer();
    h.sockets[2].drop(); // over budget → give up

    expect(h.client.getStatus()).toBe('disconnected');
    expect(h.hasTimer()).toBe(false);
  });

  it('rejects the initial connect when it never authenticates', async () => {
    const h = harness();
    const promise = h.client.connect({ url: 'http://ha.local:8123', token: 't' });
    h.sockets[0].drop();
    await expect(promise).rejects.toThrow();
    expect(h.client.getStatus()).toBe('disconnected');
    expect(h.hasTimer()).toBe(false);
  });
});

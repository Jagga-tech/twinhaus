/**
 * A minimal JSON-message socket, the browser half of the companion-service contract used by the
 * Matter backend. Injectable so the provider can be tested without a real service, and so the
 * underlying transport (a WebSocket today) can change without touching provider logic.
 */
export interface CompanionSocket {
  connect(url: string): Promise<void>;
  send(message: unknown): void;
  onMessage(listener: (message: unknown) => void): void;
  onClose(listener: () => void): void;
  close(): void;
}

/** Browser WebSocket implementation of {@link CompanionSocket}. */
export function createCompanionSocket(): CompanionSocket {
  let socket: WebSocket | null = null;
  const messageListeners = new Set<(message: unknown) => void>();
  const closeListeners = new Set<() => void>();

  return {
    connect(url) {
      return new Promise<void>((resolve, reject) => {
        socket = new WebSocket(url);
        socket.addEventListener('open', () => resolve());
        socket.addEventListener('error', () => reject(new Error(`Could not reach ${url}.`)));
        socket.addEventListener('close', () => closeListeners.forEach((listener) => listener()));
        socket.addEventListener('message', (event) => {
          try {
            const parsed = JSON.parse(String(event.data));
            messageListeners.forEach((listener) => listener(parsed));
          } catch {
            // Ignore non-JSON frames; the contract is JSON only.
          }
        });
      });
    },
    send(message) {
      socket?.send(JSON.stringify(message));
    },
    onMessage(listener) {
      messageListeners.add(listener);
    },
    onClose(listener) {
      closeListeners.add(listener);
    },
    close() {
      socket?.close();
      socket = null;
    },
  };
}

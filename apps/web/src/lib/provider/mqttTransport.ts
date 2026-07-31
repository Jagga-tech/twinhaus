import type { MqttClient } from 'mqtt';

/** One MQTT message: topic and its decoded string payload. */
export interface MqttMessage {
  topic: string;
  payload: string;
}

/**
 * The slice of an MQTT client the provider needs. Kept as an interface so the zigbee2mqtt logic
 * can be tested against a fake, and so a different MQTT library could be dropped in later.
 */
export interface MqttTransport {
  connect(url: string, options?: { username?: string; password?: string }): Promise<void>;
  subscribe(topic: string): void;
  publish(topic: string, payload: string): void;
  onMessage(listener: (message: MqttMessage) => void): void;
  onClose(listener: () => void): void;
  end(): void;
}

/**
 * Real transport backed by mqtt.js over WebSocket, so the browser talks straight to the broker
 * (e.g. `ws://broker:9001`), no Home Assistant in the path. Needs a live broker to exercise, the
 * zigbee2mqtt mapping it feeds is covered by unit tests against a fake transport.
 */
export function createMqttTransport(): MqttTransport {
  let client: MqttClient | null = null;
  const messageListeners = new Set<(message: MqttMessage) => void>();
  const closeListeners = new Set<() => void>();

  return {
    async connect(url, options) {
      // Load mqtt.js on demand so its ~150 kB only ship when the MQTT backend is actually used.
      const mqtt = (await import('mqtt')).default;
      await new Promise<void>((resolve, reject) => {
        client = mqtt.connect(url, {
          username: options?.username,
          password: options?.password,
          reconnectPeriod: 4000,
        });
        client.on('connect', () => resolve());
        client.on('error', (err) => reject(err instanceof Error ? err : new Error(String(err))));
        client.on('close', () => closeListeners.forEach((listener) => listener()));
        client.on('message', (topic, payload) =>
          messageListeners.forEach((listener) => listener({ topic, payload: payload.toString() })),
        );
      });
    },
    subscribe(topic) {
      client?.subscribe(topic);
    },
    publish(topic, payload) {
      client?.publish(topic, payload);
    },
    onMessage(listener) {
      messageListeners.add(listener);
    },
    onClose(listener) {
      closeListeners.add(listener);
    },
    end() {
      client?.end(true);
      client = null;
    },
  };
}

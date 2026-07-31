import { HaClient } from '@twinhaus/ha-bridge';
import type { DeviceProvider } from './types.js';
import { HomeAssistantProvider } from './haProvider.js';

export type { DeviceProvider, ProviderConfig, EntityState } from './types.js';

/**
 * Shared Home Assistant client. The HA provider and the two HA-only seams that have no
 * cross-backend analog, the config-flow discovery transport and the registry-based home-scan, all
 * act on this single connection.
 */
export const haClient = new HaClient();

const registry = new Map<string, DeviceProvider>();

/** Register a backend so it appears in the picker and can be made active. */
export function registerProvider(provider: DeviceProvider): DeviceProvider {
  registry.set(provider.id, provider);
  return provider;
}

const homeAssistant = registerProvider(new HomeAssistantProvider(haClient));
let active: DeviceProvider = homeAssistant;

export function listProviders(): DeviceProvider[] {
  return [...registry.values()];
}

export function getProvider(id: string): DeviceProvider | undefined {
  return registry.get(id);
}

/** The backend the app currently drives. Everything device-facing goes through this. */
export function activeProvider(): DeviceProvider {
  return active;
}

/** Switch backends. The caller re-wires store listeners and reconnects. */
export function setActiveProvider(id: string): DeviceProvider {
  const next = registry.get(id);
  if (!next) throw new Error(`Unknown provider: ${id}`);
  active = next;
  return next;
}

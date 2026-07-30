import type { RawConfigFlow, RawConfigFlowStep } from '@twinhaus/ha-bridge';

/**
 * Device categories, mirroring the web app's `deviceCategory` lib so a discovered device can be
 * rendered with the same icon and placed like any other. Discovered devices have no entity id
 * yet, so the category is guessed from the integration rather than an `entity_id`.
 */
export type DeviceCategory =
  | 'light'
  | 'switch'
  | 'lock'
  | 'climate'
  | 'sensor'
  | 'motion'
  | 'camera'
  | 'media'
  | 'cover'
  | 'other';

/** How Home Assistant found the device, the discovery transport that surfaced it. */
export type DiscoverySource = 'zeroconf' | 'ssdp' | 'dhcp' | 'bluetooth' | 'usb' | 'other';

/** A device Home Assistant has discovered but not yet configured. */
export interface DiscoveredDevice {
  /** The config flow id, stable while the flow is in progress. */
  id: string;
  name: string;
  integration: string;
  brand: string;
  source: DiscoverySource;
  category: DeviceCategory;
}

export type FlowFieldType = 'text' | 'password' | 'number' | 'boolean' | 'select';

/** A normalized form field derived from a config flow's `data_schema`. */
export interface FlowField {
  name: string;
  label: string;
  type: FlowFieldType;
  required: boolean;
  options?: Array<{ value: string; label: string }>;
  default?: unknown;
}

/** The current state of a config flow the UI is driving. */
export type FlowState =
  | {
      status: 'form';
      flowId: string;
      title: string;
      description?: string;
      fields: FlowField[];
      errors: Record<string, string>;
    }
  | { status: 'progress' }
  | { status: 'done'; title: string }
  | { status: 'aborted'; reason: string }
  | { status: 'error'; message: string };

/**
 * The seam between discovery logic and Home Assistant. The web app implements this by wiring
 * the shared `ha-bridge` client; tests implement it with a fake socket. Discovery logic never
 * touches hardware, HA is the discovery layer, we only consume its config flows.
 */
export interface DiscoveryTransport {
  subscribeFlows(onFlows: (flows: RawConfigFlow[]) => void): Promise<() => void>;
  getFlow(flowId: string): Promise<RawConfigFlowStep>;
  stepFlow(flowId: string, input: Record<string, unknown>): Promise<RawConfigFlowStep>;
  abortFlow(flowId: string): Promise<void>;
}

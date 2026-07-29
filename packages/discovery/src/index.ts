export { normalizeFlow, normalizeFlows, guessCategory } from './normalize.js';
export { ConfigFlowController, normalizeSchema } from './flowController.js';
export {
  DEVICE_CATALOG,
  searchCatalog,
  suggestForCategory,
  catalogCategories,
  catalogProtocols,
  catalogDocsUrl,
} from './catalog.js';
export type { CatalogDevice, CatalogFilter, Protocol, Setup } from './catalog.js';
export type {
  DeviceCategory,
  DiscoveredDevice,
  DiscoverySource,
  DiscoveryTransport,
  FlowField,
  FlowFieldType,
  FlowState,
} from './types.js';

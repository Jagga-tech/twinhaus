import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ConnectionStatus, HaConnectionConfig, HaEntityState } from '@twinhaus/ha-bridge';
import type { DiscoveredDevice } from '@twinhaus/discovery';
import type { PositionEstimate } from '../lib/positioning.js';
import type {
  DevicePlacement,
  EditorMode,
  ExternalAgent,
  ImportedModel,
  Level,
  Point2D,
  Room,
  TwinEvent,
  TwinModel,
  ViewMode,
  VirtualDevice,
} from './types.js';
import { DEFAULT_LEVEL, normalizeLevels, sortedLevels } from '../lib/levels.js';
import type { Scene } from '../lib/scenes.js';

export type LlmProviderId = 'anthropic' | 'openai' | 'ollama';

export interface LlmConfig {
  provider: LlmProviderId;
  apiKey: string;
  model: string;
  /** Base URL for OpenAI-compatible gateways / the local Ollama daemon. */
  baseUrl: string;
  /** Let the agent use Claude's built-in web search (Anthropic only). Default on. */
  webSearch: boolean;
}

const MAX_EVENTS = 200;

interface TwinState {
  // --- Geometry (persisted) ---
  rooms: Room[];
  devices: DevicePlacement[];
  virtualDevices: VirtualDevice[];
  /** The building's floors; a whole house is a stack of these. */
  levels: Level[];
  /** The floor currently shown in the 2D editor and 3D twin (the active "page"). */
  activeLevelId: string;

  // --- Live mirror of Home Assistant (not persisted) ---
  entityStates: Record<string, HaEntityState>;
  connectionStatus: ConnectionStatus;
  events: TwinEvent[];
  /** Devices Home Assistant has discovered but not yet configured. */
  discovered: DiscoveredDevice[];
  /** A just-added device awaiting a room click in the 3D viewer. */
  pendingPlacement: { entityId: string; label: string } | null;
  /** Live position estimates (from distance ranging) keyed by entity id; overrides static placement. */
  livePositions: Record<string, PositionEstimate>;
  /** Environment calibration for distance positioning: scales raw BLE distances (default 1). */
  positioningScale: number;

  // --- Configuration (persisted) ---
  haConfig: HaConnectionConfig;
  llmConfig: LlmConfig;
  /** The active device backend id (`homeassistant`, `demo`, `mqtt`, ...). */
  providerId: string;
  /** Durable preferences the agent has been told to remember, injected into its context. */
  agentMemory: string[];
  /** Saved scenes (named snapshots of device state) the user or agent can re-apply. */
  scenes: Scene[];
  /** Electricity tariff in dollars per kWh, for turning power draw into cost. */
  energyRatePerKwh: number;
  /** Third-party agents registered as capabilities, each exposed to Homie as an `ask_<id>` tool. */
  externalAgents: ExternalAgent[];

  // --- Onboarding (persisted) ---
  /** True once the user has finished or skipped the first-run WelcomeFlow. */
  welcomeDismissed: boolean;
  /** True once the user has sent a message to the agent (drives the "talk" onboarding step). */
  agentUsed: boolean;

  // --- Editor / view UI state (not persisted) ---
  /** The active tab in the left workspace column; lifted here so onboarding can steer it. */
  activeLeftTab: string;
  editorMode: EditorMode;
  viewMode: ViewMode;
  /** Show every floor stacked in 3D (exploded vertically) instead of just the active one. */
  stackedView: boolean;
  selectedEntityId: string | null;
  selectedDeviceId: string | null;
  highlightedEntityId: string | null;
  simulationVisible: boolean;
  importedModels: ImportedModel[];
  /** Object URL of a photo/blueprint traced over in the 2D editor (session-scoped). */
  underlayUrl: string | null;

  // --- Room actions ---
  addRoom: (name: string, polygon: Point2D[], height?: number) => void;
  removeRoom: (roomId: string) => void;
  renameRoom: (roomId: string, name: string) => void;

  // --- Level (floor) actions ---
  addLevel: (name: string) => string;
  renameLevel: (levelId: string, name: string) => void;
  removeLevel: (levelId: string) => void;
  setActiveLevel: (levelId: string) => void;
  setStackedView: (stacked: boolean) => void;

  // --- Device actions ---
  placeDevice: (entityId: string, roomId: string, position: Point2D) => void;
  unplaceDevice: (entityId: string) => void;

  // --- Virtual (simulated) device actions ---
  addVirtualDevice: (device: Omit<VirtualDevice, 'id'>) => string;
  updateVirtualDevice: (id: string, patch: Partial<Omit<VirtualDevice, 'id'>>) => void;
  removeVirtualDevice: (id: string) => void;
  clearVirtualDevices: () => void;

  // --- Home Assistant sync ---
  setEntityStates: (states: HaEntityState[]) => void;
  applyStateChange: (entityId: string, state: HaEntityState | null) => void;

  // --- Config ---
  setConnectionStatus: (status: ConnectionStatus) => void;
  setHaConfig: (config: HaConnectionConfig) => void;
  setLlmConfig: (config: Partial<LlmConfig>) => void;

  // --- UI ---
  setDiscovered: (devices: DiscoveredDevice[]) => void;
  setPendingPlacement: (placement: { entityId: string; label: string } | null) => void;
  setLivePositions: (positions: Record<string, PositionEstimate>) => void;
  setPositioningScale: (scale: number) => void;
  setProviderId: (id: string) => void;
  addAgentMemory: (note: string) => void;
  addScene: (scene: Omit<Scene, 'id'>) => string;
  removeScene: (id: string) => void;
  setEnergyRate: (rate: number) => void;
  addExternalAgent: (agent: Omit<ExternalAgent, 'id'>) => void;
  removeExternalAgent: (id: string) => void;
  setWelcomeDismissed: (dismissed: boolean) => void;
  markAgentUsed: () => void;

  setActiveLeftTab: (tab: string) => void;
  setEditorMode: (mode: EditorMode) => void;
  setViewMode: (mode: ViewMode) => void;
  setSelectedEntityId: (entityId: string | null) => void;
  setSelectedDeviceId: (deviceId: string | null) => void;
  setHighlightedEntityId: (entityId: string | null) => void;
  setSimulationVisible: (visible: boolean) => void;
  setUnderlayUrl: (url: string | null) => void;

  // --- Models & twin document ---
  addImportedModel: (model: ImportedModel) => void;
  removeImportedModel: (id: string) => void;
  exportTwin: () => TwinModel;
  importTwin: (model: TwinModel, mode?: 'replace' | 'merge') => void;
}

const DEFAULT_LLM_CONFIG: LlmConfig = {
  provider: 'anthropic',
  apiKey: '',
  model: 'claude-opus-5',
  baseUrl: '',
  webSearch: true,
};

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

/** Domains whose transitions are worth surfacing on the security timeline. */
const SECURITY_DOMAINS = ['binary_sensor', 'lock', 'cover', 'camera'];

export const useTwinStore = create<TwinState>()(
  persist(
    (set, get) => ({
      rooms: [],
      devices: [],
      virtualDevices: [],
      levels: [DEFAULT_LEVEL],
      activeLevelId: DEFAULT_LEVEL.id,
      entityStates: {},
      connectionStatus: 'disconnected',
      events: [],
      discovered: [],
      pendingPlacement: null,
      livePositions: {},
      positioningScale: 1,
      haConfig: { url: '', token: '' },
      llmConfig: DEFAULT_LLM_CONFIG,
      providerId: 'homeassistant',
      agentMemory: [],
      scenes: [],
      energyRatePerKwh: 0,
      externalAgents: [],
      welcomeDismissed: false,
      agentUsed: false,
      activeLeftTab: 'plan',
      editorMode: 'view',
      viewMode: 'normal',
      stackedView: false,
      selectedEntityId: null,
      selectedDeviceId: null,
      highlightedEntityId: null,
      simulationVisible: true,
      importedModels: [],
      underlayUrl: null,

      addRoom: (name, polygon, height = 2.6) =>
        set((state) => ({
          rooms: [
            ...state.rooms,
            { id: nextId('room'), name, polygon, height, levelId: state.activeLevelId },
          ],
        })),

      addLevel: (name) => {
        const id = nextId('level');
        set((state) => ({
          levels: [...state.levels, { id, name, order: state.levels.length }],
          activeLevelId: id,
        }));
        return id;
      },

      renameLevel: (levelId, name) =>
        set((state) => ({
          levels: state.levels.map((level) => (level.id === levelId ? { ...level, name } : level)),
        })),

      removeLevel: (levelId) =>
        set((state) => {
          if (state.levels.length <= 1) return state;
          const remaining = state.levels.filter((level) => level.id !== levelId);
          const removedRoomIds = new Set(
            state.rooms.filter((room) => room.levelId === levelId).map((room) => room.id),
          );
          const nextActive =
            state.activeLevelId === levelId ? sortedLevels(remaining)[0].id : state.activeLevelId;
          return {
            levels: remaining,
            activeLevelId: nextActive,
            rooms: state.rooms.filter((room) => room.levelId !== levelId),
            devices: state.devices.filter((device) => !removedRoomIds.has(device.roomId)),
            virtualDevices: state.virtualDevices.filter(
              (device) => !removedRoomIds.has(device.roomId),
            ),
          };
        }),

      setActiveLevel: (levelId) => set(() => ({ activeLevelId: levelId })),
      setStackedView: (stacked) => set(() => ({ stackedView: stacked })),

      removeRoom: (roomId) =>
        set((state) => ({
          rooms: state.rooms.filter((room) => room.id !== roomId),
          devices: state.devices.filter((device) => device.roomId !== roomId),
          virtualDevices: state.virtualDevices.filter((device) => device.roomId !== roomId),
        })),

      renameRoom: (roomId, name) =>
        set((state) => ({
          rooms: state.rooms.map((room) => (room.id === roomId ? { ...room, name } : room)),
        })),

      placeDevice: (entityId, roomId, position) =>
        set((state) => ({
          devices: [
            ...state.devices.filter((device) => device.entityId !== entityId),
            { entityId, roomId, position },
          ],
        })),

      unplaceDevice: (entityId) =>
        set((state) => ({
          devices: state.devices.filter((device) => device.entityId !== entityId),
        })),

      addVirtualDevice: (device) => {
        const id = nextId('virt');
        set((state) => ({ virtualDevices: [...state.virtualDevices, { ...device, id }] }));
        return id;
      },

      updateVirtualDevice: (id, patch) =>
        set((state) => ({
          virtualDevices: state.virtualDevices.map((device) =>
            device.id === id ? { ...device, ...patch } : device,
          ),
        })),

      removeVirtualDevice: (id) =>
        set((state) => ({
          virtualDevices: state.virtualDevices.filter((device) => device.id !== id),
        })),

      clearVirtualDevices: () => set(() => ({ virtualDevices: [] })),

      setEntityStates: (states) =>
        set(() => ({
          entityStates: Object.fromEntries(states.map((state) => [state.entity_id, state])),
        })),

      applyStateChange: (entityId, state) =>
        set((prev) => {
          const previous = prev.entityStates[entityId];
          const nextStates = { ...prev.entityStates };
          if (state) nextStates[entityId] = state;
          else delete nextStates[entityId];

          // Record meaningful transitions of security-relevant devices for the timeline.
          let events = prev.events;
          const domain = entityId.split('.', 1)[0];
          if (
            state &&
            previous &&
            previous.state !== state.state &&
            SECURITY_DOMAINS.includes(domain)
          ) {
            const placement = prev.devices.find((device) => device.entityId === entityId);
            const event: TwinEvent = {
              id: nextId('evt'),
              entityId,
              roomId: placement?.roomId ?? null,
              from: previous.state,
              to: state.state,
              at: Date.parse(state.last_changed) || eventClock(),
            };
            events = [event, ...prev.events].slice(0, MAX_EVENTS);
          }

          return { entityStates: nextStates, events };
        }),

      setConnectionStatus: (status) => set(() => ({ connectionStatus: status })),
      setHaConfig: (config) => set(() => ({ haConfig: config })),
      setLlmConfig: (config) => set((state) => ({ llmConfig: { ...state.llmConfig, ...config } })),

      setDiscovered: (devices) => set(() => ({ discovered: devices })),
      setPendingPlacement: (placement) => set(() => ({ pendingPlacement: placement })),
      setLivePositions: (positions) => set(() => ({ livePositions: positions })),
      setPositioningScale: (scale) =>
        set(() => ({ positioningScale: Math.max(0.6, Math.min(1.4, scale)) })),
      setProviderId: (id) => set(() => ({ providerId: id })),
      addAgentMemory: (note) =>
        set((state) => {
          const trimmed = note.trim();
          if (!trimmed || state.agentMemory.includes(trimmed)) return {};
          // Keep the most recent 30 preferences so context stays bounded.
          return { agentMemory: [...state.agentMemory, trimmed].slice(-30) };
        }),
      addScene: (scene) => {
        const id = nextId('scene');
        set((state) => ({ scenes: [...state.scenes, { ...scene, id }] }));
        return id;
      },
      removeScene: (id) => set((state) => ({ scenes: state.scenes.filter((s) => s.id !== id) })),
      setEnergyRate: (rate) => set(() => ({ energyRatePerKwh: Math.max(0, rate) })),
      addExternalAgent: (agent) =>
        set((state) => {
          const id =
            agent.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '_')
              .replace(/^_+|_+$/g, '') || `agent_${state.externalAgents.length + 1}`;
          if (!agent.url.trim() || state.externalAgents.some((a) => a.id === id)) return {};
          return { externalAgents: [...state.externalAgents, { ...agent, id }] };
        }),
      removeExternalAgent: (id) =>
        set((state) => ({ externalAgents: state.externalAgents.filter((a) => a.id !== id) })),
      setWelcomeDismissed: (dismissed) => set(() => ({ welcomeDismissed: dismissed })),
      markAgentUsed: () => set(() => ({ agentUsed: true })),

      setActiveLeftTab: (tab) => set(() => ({ activeLeftTab: tab })),
      setEditorMode: (mode) => set(() => ({ editorMode: mode })),
      setViewMode: (mode) => set(() => ({ viewMode: mode })),
      setSelectedEntityId: (entityId) => set(() => ({ selectedEntityId: entityId })),
      setSelectedDeviceId: (deviceId) => set(() => ({ selectedDeviceId: deviceId })),
      setHighlightedEntityId: (entityId) => set(() => ({ highlightedEntityId: entityId })),
      setSimulationVisible: (visible) => set(() => ({ simulationVisible: visible })),
      setUnderlayUrl: (url) => set(() => ({ underlayUrl: url })),

      addImportedModel: (model) =>
        set((state) => ({ importedModels: [...state.importedModels, model] })),

      removeImportedModel: (id) =>
        set((state) => ({ importedModels: state.importedModels.filter((m) => m.id !== id) })),

      exportTwin: () => {
        const { rooms, devices, virtualDevices, levels } = get();
        return { version: 1, rooms, devices, virtualDevices, levels };
      },

      importTwin: (model, mode = 'replace') =>
        set((state) => {
          const { levels, rooms } = normalizeLevels(model);
          if (mode === 'merge') {
            const merged = new Map(state.levels.map((level) => [level.id, level]));
            for (const level of levels) if (!merged.has(level.id)) merged.set(level.id, level);
            return {
              levels: [...merged.values()],
              rooms: [...state.rooms, ...rooms],
              devices: [...state.devices, ...model.devices],
              virtualDevices: [...state.virtualDevices, ...(model.virtualDevices ?? [])],
            };
          }
          return {
            levels,
            activeLevelId: sortedLevels(levels)[0].id,
            rooms,
            devices: model.devices,
            virtualDevices: model.virtualDevices ?? [],
          };
        }),
    }),
    {
      name: 'twinhaus',
      // Persist geometry and config, but never the live mirror or transient UI state.
      partialize: (state) => ({
        rooms: state.rooms,
        devices: state.devices,
        virtualDevices: state.virtualDevices,
        levels: state.levels,
        activeLevelId: state.activeLevelId,
        haConfig: state.haConfig,
        llmConfig: state.llmConfig,
        welcomeDismissed: state.welcomeDismissed,
        agentUsed: state.agentUsed,
        positioningScale: state.positioningScale,
        providerId: state.providerId,
        agentMemory: state.agentMemory,
        scenes: state.scenes,
        energyRatePerKwh: state.energyRatePerKwh,
        externalAgents: state.externalAgents,
      }),
    },
  ),
);

// Date.now() is avoided elsewhere for reproducibility, but event ordering needs a wall clock.
function eventClock(): number {
  return typeof performance !== 'undefined' ? performance.timeOrigin + performance.now() : 0;
}

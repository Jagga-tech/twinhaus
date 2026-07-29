import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ConnectionStatus, HaConnectionConfig, HaEntityState } from '@twinhaus/ha-bridge';
import type { DevicePlacement, EditorMode, Point2D, Room } from './types.js';

export type LlmProviderId = 'anthropic' | 'openai' | 'ollama';

export interface LlmConfig {
  provider: LlmProviderId;
  apiKey: string;
  model: string;
  /** Base URL for OpenAI-compatible gateways / the local Ollama daemon. */
  baseUrl: string;
}

interface TwinState {
  // --- Geometry (persisted) ---
  rooms: Room[];
  devices: DevicePlacement[];

  // --- Live mirror of Home Assistant (not persisted) ---
  entityStates: Record<string, HaEntityState>;
  connectionStatus: ConnectionStatus;

  // --- Configuration (persisted) ---
  haConfig: HaConnectionConfig;
  llmConfig: LlmConfig;

  // --- Editor UI state (not persisted) ---
  editorMode: EditorMode;
  selectedEntityId: string | null;

  // --- Actions ---
  addRoom: (name: string, polygon: Point2D[], height?: number) => void;
  removeRoom: (roomId: string) => void;
  renameRoom: (roomId: string, name: string) => void;

  placeDevice: (entityId: string, roomId: string, position: Point2D) => void;
  unplaceDevice: (entityId: string) => void;

  setEntityStates: (states: HaEntityState[]) => void;
  applyStateChange: (entityId: string, state: HaEntityState | null) => void;

  setConnectionStatus: (status: ConnectionStatus) => void;
  setHaConfig: (config: HaConnectionConfig) => void;
  setLlmConfig: (config: Partial<LlmConfig>) => void;

  setEditorMode: (mode: EditorMode) => void;
  setSelectedEntityId: (entityId: string | null) => void;
}

const DEFAULT_LLM_CONFIG: LlmConfig = {
  provider: 'anthropic',
  apiKey: '',
  model: 'claude-opus-5',
  baseUrl: '',
};

let idCounter = 0;
function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}

export const useTwinStore = create<TwinState>()(
  persist(
    (set) => ({
      rooms: [],
      devices: [],
      entityStates: {},
      connectionStatus: 'disconnected',
      haConfig: { url: '', token: '' },
      llmConfig: DEFAULT_LLM_CONFIG,
      editorMode: 'view',
      selectedEntityId: null,

      addRoom: (name, polygon, height = 2.6) =>
        set((state) => ({
          rooms: [...state.rooms, { id: nextId('room'), name, polygon, height }],
        })),

      removeRoom: (roomId) =>
        set((state) => ({
          rooms: state.rooms.filter((room) => room.id !== roomId),
          devices: state.devices.filter((device) => device.roomId !== roomId),
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

      setEntityStates: (states) =>
        set(() => ({
          entityStates: Object.fromEntries(states.map((state) => [state.entity_id, state])),
        })),

      applyStateChange: (entityId, state) =>
        set((prev) => {
          const next = { ...prev.entityStates };
          if (state) next[entityId] = state;
          else delete next[entityId];
          return { entityStates: next };
        }),

      setConnectionStatus: (status) => set(() => ({ connectionStatus: status })),
      setHaConfig: (config) => set(() => ({ haConfig: config })),
      setLlmConfig: (config) => set((state) => ({ llmConfig: { ...state.llmConfig, ...config } })),

      setEditorMode: (mode) => set(() => ({ editorMode: mode })),
      setSelectedEntityId: (entityId) => set(() => ({ selectedEntityId: entityId })),
    }),
    {
      name: 'twinhaus',
      // Persist geometry and config, but never the live device mirror or transient UI state.
      partialize: (state) => ({
        rooms: state.rooms,
        devices: state.devices,
        haConfig: state.haConfig,
        llmConfig: state.llmConfig,
      }),
    },
  ),
);

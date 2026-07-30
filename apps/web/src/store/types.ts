/** A point on the floor plan, in meters, in the XZ plane (Y is up in the 3D twin). */
export interface Point2D {
  x: number;
  z: number;
}

/**
 * A floor/storey of the building. A whole house is a stack of levels; the app shows one at a
 * time (the "pages" of the structure), and each {@link Room} belongs to exactly one.
 */
export interface Level {
  id: string;
  name: string;
  /** Vertical order, lowest first (e.g. basement -1, ground 0, first 1). */
  order: number;
}

/**
 * A room in the twin. Geometry is stored as a 2D polygon plus a wall height, and is
 * extruded to 3D at render time, the source of truth stays lightweight and editable.
 */
export interface Room {
  id: string;
  name: string;
  /** Ordered polygon vertices, in meters. */
  polygon: Point2D[];
  /** Wall height in meters. */
  height: number;
  /** The level (floor) this room sits on; absent means the default ground level. */
  levelId?: string;
}

/**
 * A device placed in the twin: a Home Assistant entity assigned to a room at a position.
 * Live state is mirrored separately (see {@link TwinState.entityStates}).
 */
export interface DevicePlacement {
  entityId: string;
  roomId: string;
  position: Point2D;
}

export type EditorMode = 'draw' | 'place' | 'view';

/** How the 3D twin is shaded: plain, energy heatmap, or the spatial security view. */
export type ViewMode = 'normal' | 'energy' | 'security';

/** Coarse device categories used for library models, coverage viz, and recommendations. */
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
  | 'fan'
  | 'vacuum'
  | 'other';

/**
 * A simulated device that isn't backed by Home Assistant, placed to preview coverage before
 * buying (the retrofit funnel). Cameras and motion sensors carry range/FOV for coverage viz.
 */
export interface VirtualDevice {
  id: string;
  category: DeviceCategory;
  label: string;
  roomId: string;
  position: Point2D;
  /** Facing direction in radians (used by camera FOV cones). */
  rotationY: number;
  /** Coverage range in meters (camera reach or motion radius). */
  rangeM: number;
  /** Camera horizontal field of view in degrees; ignored for omnidirectional sensors. */
  fovDeg: number;
}

/** A recent Home Assistant state change, kept for the spatial security timeline. */
export interface TwinEvent {
  id: string;
  entityId: string;
  roomId: string | null;
  from: string;
  to: string;
  /** Epoch milliseconds. */
  at: number;
}

/** A 3D model (`.glb`/`.gltf`) imported into the scene from Blender/SketchUp. */
export interface ImportedModel {
  id: string;
  name: string;
  /** Object URL for the uploaded file (session-scoped, not persisted). */
  url: string;
}

/** The portable twin document, exported for templates and consumed by the MCP server. */
export interface TwinModel {
  version: 1;
  rooms: Room[];
  devices: DevicePlacement[];
  virtualDevices: VirtualDevice[];
  /** The building's floors; absent means a single default ground level. */
  levels?: Level[];
}

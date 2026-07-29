/** A point on the floor plan, in meters, in the XZ plane (Y is up in the 3D twin). */
export interface Point2D {
  x: number;
  z: number;
}

/**
 * A room in the twin. Geometry is stored as a 2D polygon plus a wall height, and is
 * extruded to 3D at render time — the source of truth stays lightweight and editable.
 */
export interface Room {
  id: string;
  name: string;
  /** Ordered polygon vertices, in meters. */
  polygon: Point2D[];
  /** Wall height in meters. */
  height: number;
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

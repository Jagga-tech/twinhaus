import { useMemo } from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { polygonCentroid, wallSegments } from '../../lib/geometry.js';
import type { Room } from '../../store/types.js';

const WALL_THICKNESS = 0.08;

interface RoomMeshProps {
  room: Room;
  /** Overrides the floor color (used by the energy heatmap). */
  floorColor?: string;
  /** Optional caption under the room name (e.g. "120 W" in energy mode). */
  caption?: string;
}

/** Renders one room: an extruded floor slab, thin walls per edge, and a floating name label. */
export function RoomMesh({ room, floorColor, caption }: RoomMeshProps) {
  const floorGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    room.polygon.forEach((point, index) => {
      if (index === 0) shape.moveTo(point.x, point.z);
      else shape.lineTo(point.x, point.z);
    });
    shape.closePath();
    const geometry = new THREE.ShapeGeometry(shape);
    // Shapes are built in the XY plane; rotate so the polygon lies flat on XZ.
    geometry.rotateX(Math.PI / 2);
    return geometry;
  }, [room.polygon]);

  const walls = useMemo(() => wallSegments(room), [room]);
  const centroid = useMemo(() => polygonCentroid(room.polygon), [room.polygon]);

  return (
    <group>
      <mesh geometry={floorGeometry} receiveShadow position={[0, 0.01, 0]}>
        <meshStandardMaterial color={floorColor ?? '#cfd8dc'} side={THREE.DoubleSide} />
      </mesh>

      {walls.map((wall, index) => (
        <mesh key={index} position={wall.center} rotation={[0, wall.rotationY, 0]} castShadow>
          <boxGeometry args={[wall.length, room.height, WALL_THICKNESS]} />
          <meshStandardMaterial color="#eceff1" transparent opacity={0.55} />
        </mesh>
      ))}

      <Text
        position={[centroid.x, room.height + 0.2, centroid.z]}
        fontSize={0.35}
        color="#37474f"
        anchorX="center"
        anchorY="middle"
      >
        {caption ? `${room.name}\n${caption}` : room.name}
      </Text>
    </group>
  );
}

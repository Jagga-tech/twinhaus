import { useMemo } from 'react';
import * as THREE from 'three';
import type { VirtualDevice } from '../../store/types.js';

/**
 * Draws a device's coverage footprint flat on the floor: a directional sector for cameras,
 * a full circle for motion/omnidirectional sensors. This is what makes "simulate before you
 * buy" tangible, you see exactly what a placement would and wouldn't cover.
 */
export function CoverageViz({ device }: { device: VirtualDevice }) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    const directional = device.category === 'camera';
    const half = directional ? (device.fovDeg * Math.PI) / 360 : Math.PI;
    const segments = 32;

    shape.moveTo(0, 0);
    for (let i = 0; i <= segments; i++) {
      const angle = -half + (2 * half * i) / segments;
      shape.lineTo(Math.cos(angle) * device.rangeM, Math.sin(angle) * device.rangeM);
    }
    shape.closePath();

    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(Math.PI / 2); // lie flat on XZ
    return geo;
  }, [device.category, device.fovDeg, device.rangeM]);

  if (device.rangeM <= 0) return null;

  const color = device.category === 'camera' ? '#42a5f5' : '#66bb6a';

  return (
    <mesh
      geometry={geometry}
      position={[device.position.x, 0.03, device.position.z]}
      rotation={[0, device.rotationY, 0]}
    >
      <meshBasicMaterial color={color} transparent opacity={0.22} side={THREE.DoubleSide} />
    </mesh>
  );
}

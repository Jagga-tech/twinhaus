import { Html } from '@react-three/drei';
import { CoverageViz } from './CoverageViz.js';
import type { VirtualDevice } from '../../store/types.js';

/** A simulated (not-yet-purchased) device: a dashed marker plus its coverage footprint. */
export function VirtualDeviceMarker({ device }: { device: VirtualDevice }) {
  return (
    <group>
      <CoverageViz device={device} />
      <group position={[device.position.x, 1.1, device.position.z]}>
        <mesh>
          <boxGeometry args={[0.2, 0.2, 0.2]} />
          <meshStandardMaterial color="#5c6bc0" transparent opacity={0.7} wireframe />
        </mesh>
        <Html distanceFactor={8} position={[0, 0.28, 0]} center>
          <div className="device-label device-label-virtual">{device.label}</div>
        </Html>
      </group>
    </group>
  );
}

import { Html } from '@react-three/drei';
import type { HaEntityState } from '@twinhaus/ha-bridge';
import { entityLabel, isEntityActive } from '../../lib/deviceState.js';
import type { DevicePlacement } from '../../store/types.js';

interface DeviceMarkerProps {
  device: DevicePlacement;
  state: HaEntityState | undefined;
}

/**
 * A device in the twin. Its visual mirrors real state — an active entity (a light that is
 * `on`, a lock that is `unlocked`) glows, so a glance at the 3D model reads like the house.
 */
export function DeviceMarker({ device, state }: DeviceMarkerProps) {
  const active = isEntityActive(state);
  const color = active ? '#ffca28' : '#607d8b';

  return (
    <group position={[device.position.x, 1.1, device.position.z]}>
      <mesh castShadow>
        <sphereGeometry args={[0.14, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={active ? color : '#000000'}
          emissiveIntensity={active ? 0.9 : 0}
        />
      </mesh>
      {active && <pointLight color={color} intensity={6} distance={3} />}
      <Html distanceFactor={8} position={[0, 0.28, 0]} center>
        <div className="device-label">{entityLabel(device.entityId, state)}</div>
      </Html>
    </group>
  );
}

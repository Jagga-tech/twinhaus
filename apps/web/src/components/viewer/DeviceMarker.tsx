import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type { HaEntityState } from '@twinhaus/ha-bridge';
import { entityLabel, isEntityActive } from '../../lib/deviceState.js';
import { CATEGORY_GLYPH, categorize } from '../../lib/deviceCategory.js';
import { DEVICE_MODELS } from '../../lib/deviceLibrary.js';
import type { DevicePlacement } from '../../store/types.js';

interface DeviceMarkerProps {
  device: DevicePlacement;
  state: HaEntityState | undefined;
  highlighted?: boolean;
  onSelect?: (entityId: string) => void;
}

/**
 * A device in the twin. Its visual mirrors real state — an active entity (a light that is
 * `on`, a lock that is `unlocked`) glows. Clicking selects it for the inspector; the security
 * view highlights the device that just changed.
 */
export function DeviceMarker({ device, state, highlighted, onSelect }: DeviceMarkerProps) {
  const active = isEntityActive(state);
  const category = categorize(device.entityId, state);
  const model = DEVICE_MODELS[category];
  const color = highlighted ? '#ef5350' : active ? '#ffca28' : '#607d8b';

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    onSelect?.(device.entityId);
  }

  return (
    <group position={[device.position.x, 1.1, device.position.z]} onClick={handleClick}>
      <mesh castShadow scale={highlighted ? 1.4 : 1}>
        {model.shape === 'sphere' && (
          <sphereGeometry args={model.args as [number, number, number]} />
        )}
        {model.shape === 'box' && <boxGeometry args={model.args as [number, number, number]} />}
        {model.shape === 'cylinder' && (
          <cylinderGeometry args={model.args as [number, number, number, number]} />
        )}
        {model.shape === 'cone' && <coneGeometry args={model.args as [number, number, number]} />}
        <meshStandardMaterial
          color={color}
          emissive={active || highlighted ? color : '#000000'}
          emissiveIntensity={active || highlighted ? 0.9 : 0}
        />
      </mesh>
      {(active || highlighted) && <pointLight color={color} intensity={6} distance={3} />}
      <Html distanceFactor={8} position={[0, 0.28, 0]} center>
        <div className="device-label">
          {CATEGORY_GLYPH[category]} {entityLabel(device.entityId, state)}
        </div>
      </Html>
    </group>
  );
}

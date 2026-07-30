import { useState } from 'react';
import { Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type { HaEntityState } from '@twinhaus/ha-bridge';
import { entityLabel, isEntityActive, deviceGlow, compactState } from '../../lib/deviceState.js';
import { CATEGORY_GLYPH, categorize } from '../../lib/deviceCategory.js';
import { DEVICE_MODELS } from '../../lib/deviceLibrary.js';
import type { PositionEstimate } from '../../lib/positioning.js';
import type { DevicePlacement } from '../../store/types.js';

interface DeviceMarkerProps {
  device: DevicePlacement;
  state: HaEntityState | undefined;
  highlighted?: boolean;
  /** Live position from distance ranging; overrides the static placement when present. */
  livePosition?: PositionEstimate;
  onSelect?: (entityId: string) => void;
}

/**
 * A device in the twin. Its visual mirrors real state, an active entity (a light that is
 * `on`, a lock that is `unlocked`) glows, a light shows its real colour and brightness, and the
 * label carries a live value badge. Clicking selects it for the inspector; hovering lifts it;
 * the security view highlights the device that just changed.
 */
export function DeviceMarker({
  device,
  state,
  highlighted,
  livePosition,
  onSelect,
}: DeviceMarkerProps) {
  const [hovered, setHovered] = useState(false);
  const active = isEntityActive(state);
  const category = categorize(device.entityId, state);
  const model = DEVICE_MODELS[category];
  const glow = deviceGlow(state);
  // Live state colours the device: red when it just changed (security view), otherwise its real
  // glow colour when active (a bulb's actual RGB), or a neutral slate when idle.
  const color = highlighted ? '#ef5350' : active ? glow.color : '#607d8b';
  const position = livePosition ? livePosition.position : device.position;
  const badge = compactState(state);
  // A cover that's open lifts, so an open blind/garage reads as open in the twin.
  const coverLift = category === 'cover' && state?.state === 'open' ? 0.18 : 0;
  const scale = highlighted ? 1.4 : hovered ? 1.15 : 1;

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    onSelect?.(device.entityId);
  }

  function handleOver(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  }

  function handleOut() {
    setHovered(false);
    document.body.style.cursor = 'auto';
  }

  return (
    <group
      position={[position.x, 1.1 + coverLift, position.z]}
      onClick={handleClick}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
    >
      {livePosition && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5 - coverLift, 0]}>
          <ringGeometry args={[0.3, 0.38, 24]} />
          <meshBasicMaterial
            color="#29b6f6"
            transparent
            opacity={0.4 + 0.4 * livePosition.confidence}
          />
        </mesh>
      )}
      <mesh castShadow scale={scale}>
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
          emissiveIntensity={highlighted ? 0.9 : active ? 0.9 * glow.intensity : 0}
        />
      </mesh>
      {(active || highlighted) && (
        <pointLight color={color} intensity={6 * (highlighted ? 1 : glow.intensity)} distance={3} />
      )}
      <Html distanceFactor={8} position={[0, 0.28, 0]} center>
        <div className={`device-label${hovered ? ' hovered' : ''}`}>
          {CATEGORY_GLYPH[category]} {entityLabel(device.entityId, state)}
          {badge && <span className="device-label-state">{badge}</span>}
        </div>
      </Html>
    </group>
  );
}

import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import { useTwinStore } from '../../store/twinStore.js';
import { RoomMesh } from './RoomMesh.js';
import { DeviceMarker } from './DeviceMarker.js';

/**
 * The 3D twin: rooms extruded from the floor plan, with live device markers on top.
 * Orbit/pan to walk around the home. This is the "3D feedback" half of chat-plus-3D.
 */
export function TwinViewer() {
  const rooms = useTwinStore((state) => state.rooms);
  const devices = useTwinStore((state) => state.devices);
  const entityStates = useTwinStore((state) => state.entityStates);

  return (
    <Canvas shadows camera={{ position: [8, 9, 12], fov: 50 }} className="twin-canvas">
      <color attach="background" args={['#f5f7f8']} />
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 15, 8]} intensity={1.1} castShadow />

      <Grid
        args={[40, 40]}
        cellSize={1}
        cellColor="#cfd8dc"
        sectionSize={5}
        sectionColor="#90a4ae"
        infiniteGrid
        fadeDistance={40}
        position={[0, 0, 0]}
      />

      {rooms.map((room) => (
        <RoomMesh key={room.id} room={room} />
      ))}

      {devices.map((device) => (
        <DeviceMarker key={device.entityId} device={device} state={entityStates[device.entityId]} />
      ))}

      <OrbitControls makeDefault target={[0, 0, 0]} maxPolarAngle={Math.PI / 2.05} />
    </Canvas>
  );
}

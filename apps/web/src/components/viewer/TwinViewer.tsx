import { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import { useTwinStore } from '../../store/twinStore.js';
import { computeRoomEnergy, heatColor } from '../../lib/energy.js';
import { polygonCentroid } from '../../lib/geometry.js';
import { roomsOnLevel, devicesOnLevel, sortedLevels, levelElevation } from '../../lib/levels.js';
import { RoomMesh } from './RoomMesh.js';
import { DeviceMarker } from './DeviceMarker.js';
import { VirtualDeviceMarker } from './VirtualDeviceMarker.js';
import { ImportedModelMesh } from './ImportedModelMesh.js';

/**
 * The 3D twin: rooms extruded from the floor plan, with live device markers on top. Supports
 * three shading modes, plain, an energy heatmap (floors colored by consumption), and a
 * security view (the device that just changed is highlighted).
 */
export function TwinViewer() {
  const allRooms = useTwinStore((state) => state.rooms);
  const allDevices = useTwinStore((state) => state.devices);
  const allVirtualDevices = useTwinStore((state) => state.virtualDevices);
  const levels = useTwinStore((state) => state.levels);
  const activeLevelId = useTwinStore((state) => state.activeLevelId);
  const stackedView = useTwinStore((state) => state.stackedView);
  const entityStates = useTwinStore((state) => state.entityStates);
  const viewMode = useTwinStore((state) => state.viewMode);
  const highlightedEntityId = useTwinStore((state) => state.highlightedEntityId);
  const livePositions = useTwinStore((state) => state.livePositions);
  const simulationVisible = useTwinStore((state) => state.simulationVisible);
  const importedModels = useTwinStore((state) => state.importedModels);
  const setSelectedDeviceId = useTwinStore((state) => state.setSelectedDeviceId);
  const pendingPlacement = useTwinStore((state) => state.pendingPlacement);
  const placeDevice = useTwinStore((state) => state.placeDevice);
  const setPendingPlacement = useTwinStore((state) => state.setPendingPlacement);

  // Which floors to draw: just the active one, or every storey stacked vertically.
  const renderLevels = useMemo(() => {
    const shown = stackedView
      ? sortedLevels(levels)
      : (levels.filter((level) => level.id === activeLevelId) ?? []);
    const list = shown.length > 0 ? shown : [{ id: activeLevelId, name: '', order: 0 }];
    return list.map((level) => ({
      id: level.id,
      y: stackedView ? levelElevation(levels, level.id) : 0,
      rooms: roomsOnLevel(allRooms, level.id),
      devices: devicesOnLevel(allDevices, allRooms, level.id),
      virtual: devicesOnLevel(allVirtualDevices, allRooms, level.id),
    }));
  }, [stackedView, levels, activeLevelId, allRooms, allDevices, allVirtualDevices]);

  const energy = useMemo(() => {
    const rooms = renderLevels.flatMap((l) => l.rooms);
    const devices = renderLevels.flatMap((l) => l.devices);
    return computeRoomEnergy(rooms, devices, entityStates);
  }, [renderLevels, entityStates]);

  function placeIntoRoom(roomId: string) {
    if (!pendingPlacement) return;
    const room = allRooms.find((r) => r.id === roomId);
    if (!room) return;
    placeDevice(pendingPlacement.entityId, roomId, polygonCentroid(room.polygon));
    setPendingPlacement(null);
  }

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

      {renderLevels.map((floor) => (
        <group key={floor.id} position={[0, floor.y, 0]}>
          {floor.rooms.map((room) => {
            const watts = energy.byRoom[room.id] ?? 0;
            const floorColor =
              viewMode === 'energy' && energy.max > 0 ? heatColor(watts / energy.max) : undefined;
            const caption = viewMode === 'energy' ? `${Math.round(watts)} W` : undefined;
            return (
              <RoomMesh
                key={room.id}
                room={room}
                floorColor={floorColor}
                caption={caption}
                onPick={pendingPlacement && !stackedView ? placeIntoRoom : undefined}
              />
            );
          })}

          {floor.devices.map((device) => (
            <DeviceMarker
              key={device.entityId}
              device={device}
              state={entityStates[device.entityId]}
              highlighted={viewMode === 'security' && highlightedEntityId === device.entityId}
              livePosition={livePositions[device.entityId]}
              onSelect={setSelectedDeviceId}
            />
          ))}

          {simulationVisible &&
            floor.virtual.map((device) => <VirtualDeviceMarker key={device.id} device={device} />)}
        </group>
      ))}

      {importedModels.map((model) => (
        <ImportedModelMesh key={model.id} model={model} />
      ))}

      <OrbitControls makeDefault target={[0, 0, 0]} maxPolarAngle={Math.PI / 2.05} />
    </Canvas>
  );
}

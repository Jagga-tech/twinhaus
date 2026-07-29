import { useEffect, useRef, useState } from 'react';
import { useTwinStore } from '../../store/twinStore.js';
import { polygonCentroid, roomAt } from '../../lib/geometry.js';
import { entityLabel, isEntityActive } from '../../lib/deviceState.js';
import type { Point2D } from '../../store/types.js';

const PIXELS_PER_METER = 42;

/**
 * The 2D floor plan editor — the entry point for everyone, including homes with zero smart
 * devices. Draw rooms as polygons, then drop Home Assistant entities into them. The 3D twin
 * is extruded from exactly this geometry.
 */
export function FloorPlanEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [draft, setDraft] = useState<Point2D[]>([]);

  const rooms = useTwinStore((state) => state.rooms);
  const devices = useTwinStore((state) => state.devices);
  const entityStates = useTwinStore((state) => state.entityStates);
  const mode = useTwinStore((state) => state.editorMode);
  const selectedEntityId = useTwinStore((state) => state.selectedEntityId);
  const addRoom = useTwinStore((state) => state.addRoom);
  const placeDevice = useTwinStore((state) => state.placeDevice);
  const setSelectedEntityId = useTwinStore((state) => state.setSelectedEntityId);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawScene(ctx, canvas.width, canvas.height, { rooms, devices, entityStates, draft });
  }, [rooms, devices, entityStates, draft]);

  function toMeters(event: React.MouseEvent<HTMLCanvasElement>): Point2D {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    return {
      x: (px - canvas.width / 2) / PIXELS_PER_METER,
      z: (py - canvas.height / 2) / PIXELS_PER_METER,
    };
  }

  function handleClick(event: React.MouseEvent<HTMLCanvasElement>) {
    const point = toMeters(event);

    if (mode === 'draw') {
      setDraft((prev) => [...prev, point]);
      return;
    }

    if (mode === 'place' && selectedEntityId) {
      const room = roomAt(point, rooms);
      if (!room) {
        window.alert('Drop the device inside a room.');
        return;
      }
      placeDevice(selectedEntityId, room.id, point);
      setSelectedEntityId(null);
    }
  }

  function finishRoom() {
    if (draft.length < 3) {
      window.alert('A room needs at least 3 corners.');
      return;
    }
    const name = window.prompt('Name this room:', `Room ${rooms.length + 1}`);
    if (name) addRoom(name, draft);
    setDraft([]);
  }

  return (
    <div className="editor">
      <div className="editor-toolbar">
        {mode === 'draw' && (
          <>
            <span className="hint">Click to add corners.</span>
            <button onClick={finishRoom} disabled={draft.length < 3}>
              Finish room ({draft.length})
            </button>
            <button onClick={() => setDraft([])} disabled={draft.length === 0}>
              Clear
            </button>
          </>
        )}
        {mode === 'place' &&
          (selectedEntityId ? (
            <span className="hint">
              Click inside a room to place <strong>{selectedEntityId}</strong>.
            </span>
          ) : (
            <span className="hint">Select a device from the panel, then click a room.</span>
          ))}
        {mode === 'view' && <span className="hint">Switch to Draw or Place to edit the plan.</span>}
      </div>
      <canvas
        ref={canvasRef}
        width={720}
        height={520}
        className="editor-canvas"
        onClick={handleClick}
      />
    </div>
  );
}

interface SceneInput {
  rooms: ReturnType<typeof useTwinStore.getState>['rooms'];
  devices: ReturnType<typeof useTwinStore.getState>['devices'];
  entityStates: ReturnType<typeof useTwinStore.getState>['entityStates'];
  draft: Point2D[];
}

function drawScene(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scene: SceneInput,
) {
  ctx.clearRect(0, 0, width, height);
  const cx = width / 2;
  const cy = height / 2;
  const toPx = (p: Point2D) => ({ x: cx + p.x * PIXELS_PER_METER, y: cy + p.z * PIXELS_PER_METER });

  // 1-meter grid.
  ctx.strokeStyle = '#eceff1';
  ctx.lineWidth = 1;
  for (let x = cx % PIXELS_PER_METER; x < width; x += PIXELS_PER_METER) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = cy % PIXELS_PER_METER; y < height; y += PIXELS_PER_METER) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Rooms.
  for (const room of scene.rooms) {
    ctx.beginPath();
    room.polygon.forEach((point, index) => {
      const p = toPx(point);
      if (index === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(144, 164, 174, 0.18)';
    ctx.fill();
    ctx.strokeStyle = '#607d8b';
    ctx.lineWidth = 2;
    ctx.stroke();

    const centroid = toPx(polygonCentroid(room.polygon));
    ctx.fillStyle = '#37474f';
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(room.name, centroid.x, centroid.y);
  }

  // Devices.
  for (const device of scene.devices) {
    const p = toPx(device.position);
    const active = isEntityActive(scene.entityStates[device.entityId]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = active ? '#ffca28' : '#607d8b';
    ctx.fill();
    ctx.fillStyle = '#455a64';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      entityLabel(device.entityId, scene.entityStates[device.entityId]),
      p.x + 9,
      p.y + 4,
    );
  }

  // Draft polygon in progress.
  if (scene.draft.length > 0) {
    ctx.beginPath();
    scene.draft.forEach((point, index) => {
      const p = toPx(point);
      if (index === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = '#00897b';
    ctx.lineWidth = 2;
    ctx.stroke();
    for (const point of scene.draft) {
      const p = toPx(point);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#00897b';
      ctx.fill();
    }
  }
}

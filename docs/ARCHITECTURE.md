# Twinhaus architecture

## Design principle

Twinhaus is a **3D + AI layer on top of Home Assistant**, never a replacement for it. Home Assistant handles all hardware communication (Zigbee, Z-Wave, Matter, WiFi) through its 2000+ integrations. Twinhaus consumes HA's WebSocket API and adds two things HA doesn't have: a spatial 3D interface and an LLM agent.

## Layers

### 1. Browser (frontend)
- **3D twin viewer** — React Three Fiber renders the home model. Devices are 3D objects positioned in rooms; their visual state mirrors real state (a light entity that's `on` glows in the model).
- **Chat control** — a chat panel wired to the agent. Commands and questions in natural language.

### 2. Twinhaus core
- **Twin state engine** — the source of truth for the twin: room geometry, device-to-room assignments, and a live mirror of HA entity states. Geometry is stored as JSON (floor plan polygons + heights, extruded to 3D at load).
- **AI agent** — an LLM with tool-calling. Tools map to HA services (`light.turn_on`, `lock.lock`, `climate.set_temperature`) plus twin-specific tools (`get_room_devices`, `get_energy_by_room`). Provider-agnostic: Anthropic/OpenAI APIs or local models via Ollama.

### 3. Home Assistant (device layer)
- Connected via long-lived access token over the WebSocket API
- We subscribe to `state_changed` events for live updates
- We call HA services for all device control
- Zero direct hardware communication in Twinhaus

## Data flow

**Event up:** device changes → HA `state_changed` event → ha-bridge → twin state engine → 3D viewer re-renders that device.

**Command down:** user message → agent → tool call → ha-bridge → HA service call → real device changes → event flows back up → twin confirms visually.

## Onboarding paths

1. **Draw** — built-in 2D floor plan editor, auto-extruded to 3D. Works for everyone.
2. **Scan** — iPhone LiDAR via RoomPlan export (Phase 2).
3. **Import** — bring a `.glb`/`.gltf` from Blender or SketchUp.

Users then drag unassigned HA entities onto rooms to place them in the twin.

## Non-goals

- Reimplementing device integrations (that's HA's job)
- Cloud accounts or hosted service (local-first; self-host)
- Photorealistic rendering (clean, legible stylized 3D beats realism here)

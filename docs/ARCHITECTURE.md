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

- **View modes** — the same twin, shaded three ways: normal, an **energy heatmap** (floors colored by per-room power draw), and a **security view** (the device that just changed is highlighted, driven by an event ring buffer).
- **Simulation** — virtual (not-yet-purchased) devices placed alongside real ones, with camera/motion **coverage footprints** rendered on the floor. The recommendation wizard drops a budget-tier kit in as simulated devices — the "simulate before you buy" path for homes with zero smart devices.

### 3. Home Assistant (device layer)

- Connected via long-lived access token over the WebSocket API
- We subscribe to `state_changed` events for live updates
- We call HA services for all device control
- Zero direct hardware communication in Twinhaus

### 4. MCP server (external surface)

- `@twinhaus/mcp-server` exposes the twin (rooms, devices, per-room energy) and HA control as MCP tools, so any MCP-capable AI assistant can query and control the home. It reads a twin document exported from the web app and reuses `ha-bridge` for live state and service calls.

## Data flow

**Event up:** device changes → HA `state_changed` event → ha-bridge → twin state engine → 3D viewer re-renders that device.

**Command down:** user message → agent → tool call → ha-bridge → HA service call → real device changes → event flows back up → twin confirms visually.

## Onboarding paths

1. **Draw** — built-in 2D floor plan editor, auto-extruded to 3D. Works for everyone. A photo or blueprint can be loaded as a tracing underlay.
2. **Scan** — iPhone LiDAR via a RoomPlan-style capture JSON, imported into rooms.
3. **Import** — bring a `.glb`/`.gltf` from Blender or SketchUp, or start from a built-in home template.

Users then select unassigned HA entities and place them into rooms. The whole twin can be exported/imported as a JSON document (used for templates and consumed by the MCP server).

## Packaging

- **Home Assistant add-on** (`addon/`) serves the built web app inside HA via Ingress.
- **Local-first LLM** — Ollama support means the agent can run with no data leaving the machine.

## Non-goals

- Reimplementing device integrations (that's HA's job)
- Cloud accounts or hosted service (local-first; self-host)
- Photorealistic rendering (clean, legible stylized 3D beats realism here)

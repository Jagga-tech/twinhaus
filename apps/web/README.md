# @twinhaus/web

React + React Three Fiber frontend: the 2D floor plan editor, 3D twin viewer, and chat panel. Holds the **twin state engine** (a Zustand store) that mirrors live Home Assistant state and drives both the editor and the 3D scene.

## Run

```bash
npm install      # from the repo root (workspaces)
npm run dev      # starts Vite on http://localhost:5173
```

Then: draw a floor plan (Draw mode), open **Settings** to connect your Home Assistant instance (URL + long-lived token) and pick an AI provider, drop devices into rooms (Place mode), and control them from the chat panel.

## Structure

- `store/`, the twin state engine (rooms, device placements, live entity mirror, config).
- `lib/`, geometry helpers, device-state helpers, and the `HomeContext` adapter that wires the agent to the twin + bridge.
- `components/editor/`, 2D floor plan editor and the entity panel.
- `components/viewer/`, the React Three Fiber 3D twin (rooms extruded from the plan, live device markers).
- `components/chat/`, natural-language control panel.
- `components/settings/`, Home Assistant + LLM provider configuration.

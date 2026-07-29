# Roadmap

All four phases are implemented. Items below are checked with a short note on where each lives.

## Phase 1 — MVP

The smallest thing that's demo-able and useful.

- [x] 2D floor plan editor (draw rooms as polygons, set heights) — `apps/web/src/components/editor`
- [x] 3D extrusion + orbit/walkthrough camera — `apps/web/src/components/viewer`
- [x] Home Assistant connection (URL + long-lived token) — `packages/ha-bridge`
- [x] Live entity states rendered in 3D (lights, binary sensors, and more)
- [x] Entity-to-room assignment (select + place)
- [x] Chat control via agent tool-calling — `packages/agent`

**Ship criteria:** a stranger can clone the repo, draw their apartment, connect HA, and turn a real light on from the 3D twin.

## Phase 2 — Depth

- [x] Capture import (RoomPlan-style JSON → rooms) — `apps/web/src/lib/twinIo.ts`
- [x] More device types (locks, climate, cameras, media, covers) + click-to-control inspector
- [x] Per-room energy heatmap (from power/energy entities) — `apps/web/src/lib/energy.ts`
- [x] Agent automations ("turn everything off when I leave") via `list_entities` + `call_service`
- [x] Event timeline plotted spatially (security view) — highlights the room/device that changed

## Phase 3 — Retrofit story

- [x] Simulation mode: place virtual devices, preview camera/motion coverage — `CoverageViz`
- [x] Device recommendation wizard (Starter/Mid/Full tiers, renter vs owner, home age)
- [x] Local LLM support via Ollama — `packages/agent/src/providers/ollama.ts`
- [x] `.glb`/`.gltf` model import and photo/blueprint tracing underlay
- [x] Package as a Home Assistant add-on — `addon/`

## Phase 4 — Community

- [x] Built-in low-poly device model library (per-category shapes; `.glb` override) — `deviceLibrary.ts`
- [x] Shared room/home templates + twin export/import — `templates.ts`, `twinIo.ts`
- [x] MCP server so external AI assistants can query and control the twin — `packages/mcp-server`

## Discovery — "Found near you"

- [x] Consume HA's pending config flows (discovered-but-unconfigured devices) — `packages/discovery`
- [x] Normalize into `DiscoveredDevice` (name, brand, source, best-guess category)
- [x] Drive a config flow to completion, rendering PIN/credential forms from the flow schema
- [x] "Found near you" tray with a live count badge and one-click **Add**
- [x] Instant room placement in the 3D twin after adding
- [x] Read-only agent tool `list_discovered_devices` (the agent never completes a flow)
- [x] Optional, clearly-separated Web Bluetooth "Quick scan (beta)", informational only
- [x] `docs/DISCOVERY.md` — how it works, `cors_allowed_origins`, ESPHome BT proxies

## Catalog — search everything you can add

- [x] Cross-brand `DEVICE_CATALOG` spanning every category, local & cloud setups, all radios — `packages/discovery/src/catalog.ts`
- [x] `searchCatalog` free-text + category/protocol/setup/price filters, cheapest-first
- [x] Catalog browse tab: search, filter, simulate-in-twin, and "How to add →" HA docs link
- [x] Recommendation wizard names a real catalog pick per device (`suggestForCategory`)
- [x] Read-only agent tool `search_device_catalog` (recommends only; HA still does the adding)
- [x] `docs/CATALOG.md` — data model, search semantics, why it's curated

## Beyond the plan

- Matter and energy monitors (Emporia/Shelly) are consumed automatically as Home Assistant
  entities — the energy heatmap reads their power values with no extra integration.
- Native on-device LiDAR scanning and photo→floorplan CV are iOS/vision problems outside the
  web app; Twinhaus implements the **import** side so those pipelines land as editable rooms.

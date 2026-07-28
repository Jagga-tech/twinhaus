# Roadmap

## Phase 1 — MVP (target: 6 weeks)
The smallest thing that's demo-able and useful.
- [ ] 2D floor plan editor (draw rooms as polygons, set heights)
- [ ] 3D extrusion + orbit/walkthrough camera
- [ ] Home Assistant connection (URL + long-lived token)
- [ ] Live entity states rendered in 3D (lights, binary sensors)
- [ ] Drag-and-drop entity-to-room assignment
- [ ] Chat control of lights via agent tool-calling

**Ship criteria:** a stranger can clone the repo, draw their apartment, connect HA, and turn a real light on from the 3D twin.

## Phase 2 — Depth
- [ ] iPhone LiDAR capture (RoomPlan import)
- [ ] More device types: locks, climate, cameras, media players
- [ ] Per-room energy heatmap (needs energy monitor entities)
- [ ] Agent automations ("turn everything off when I leave")
- [ ] Event timeline plotted spatially (security view)

## Phase 3 — Retrofit story
- [ ] Simulation mode: place virtual devices, preview sensor/camera coverage
- [ ] Device recommendation wizard (budget tiers, renter vs owner)
- [ ] Local LLM support via Ollama
- [ ] Package as a Home Assistant add-on

## Phase 4 — Community
- [ ] Community library of low-poly device models
- [ ] Shared room/home templates
- [ ] MCP server so external AI assistants can query the twin

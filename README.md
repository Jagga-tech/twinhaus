<p align="center">
  <img src="assets/banner.svg" alt="Twinhaus — turn any home into an AI home" width="100%"/>
</p>

<p align="center">
  <b>Turn any home into an AI home.</b><br/>
  An open-source 3D digital twin of your house, with an AI agent as its brain.<br/>
  Built on top of <a href="https://www.home-assistant.io/">Home Assistant</a>.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-early%20development-orange" alt="Status"/>
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License"/>
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs Welcome"/>
  <img src="https://img.shields.io/badge/built%20with-Three.js-black" alt="Three.js"/>
</p>

---

## What is Twinhaus?

Twinhaus is a live, walkable 3D replica of your real home that runs in the browser. Every smart device in your house appears in the model exactly where it is in real life — and an AI agent controls all of it through natural language.

Say *"dim the living room and lock the back door"* and watch it happen in the twin as it happens in your house.

Your home already has the data. Home Assistant already talks to 2000+ devices. What's missing is a spatial, intelligent way to see and control it all. That's Twinhaus.

## Why?

- **Dashboards are lists. Homes are spaces.** A motion alert means more when you see *which door* it came from, in 3D.
- **Works with the home you already have.** Old house, rented apartment, zero smart devices — start with a floor plan and grow from there.
- **Simulate before you buy.** Place a virtual camera or sensor in the twin, check its coverage, *then* spend money.
- **Local-first.** Runs against your own Home Assistant instance. Bring your own LLM — cloud APIs or fully local via Ollama.

## How it works

```
┌─────────────────────────────────────────────┐
│  Browser                                    │
│  ┌──────────────────┐  ┌─────────────────┐  │
│  │  3D twin viewer  │  │  Chat control   │  │
│  │  (Three.js)      │  │  (talk to home) │  │
│  └──────────────────┘  └─────────────────┘  │
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────┴──────────────────────┐
│  Twinhaus core                              │
│  ┌──────────────────┐  ┌─────────────────┐  │
│  │ Twin state engine│  │    AI agent     │  │
│  │ rooms · devices  │  │ LLM + tool calls│  │
│  └──────────────────┘  └─────────────────┘  │
└──────────────────────┬──────────────────────┘
                       │  WebSocket API
┌──────────────────────┴──────────────────────┐
│  Home Assistant  (2000+ integrations)       │
└──────────────────────┬──────────────────────┘
                       │
        Zigbee · Matter · WiFi devices
```

Twinhaus never talks to hardware directly — Home Assistant is the device layer. We are the 3D + AI layer on top.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full design.

## Getting started

> ⚠️ Twinhaus is in early development. The MVP targets: floor plan editor → 3D extrusion → live Home Assistant device states → chat control of lights.

```bash
git clone https://github.com/YOUR_USERNAME/twinhaus.git
cd twinhaus
npm install
npm run dev
```

Then open `http://localhost:5173`, draw your floor plan, and connect your Home Assistant instance (Settings → paste your HA URL + long-lived access token).

## Project structure

```
twinhaus/
├── apps/
│   └── web/            # React + React Three Fiber frontend
├── packages/
│   ├── agent/          # AI agent — LLM tool-calling against HA services
│   └── ha-bridge/      # Home Assistant WebSocket client + state sync
├── assets/             # Logo, brand assets
└── docs/               # Architecture, roadmap
```

## Roadmap

- [ ] **Phase 1 — MVP**: 2D floor plan editor, 3D extrusion, HA connection, live light/sensor states, chat control of lights
- [ ] **Phase 2**: LiDAR capture (iPhone RoomPlan), more device types, per-room energy heatmap, agent automations
- [ ] **Phase 3**: Simulation mode (place virtual devices before buying), device recommendation wizard, local LLM support, HA add-on packaging
- [ ] **Phase 4**: Community device model library, shared room templates, MCP server

Full details in [docs/ROADMAP.md](docs/ROADMAP.md).

## Contributing

Contributions are very welcome — this project is being built in the open from day one. Read [CONTRIBUTING.md](CONTRIBUTING.md) to get started, or grab an issue labeled `good first issue`.

## License

[MIT](LICENSE) — free to use, fork, and build on.

---

<p align="center">Made with ☕ in Hayward, CA</p>

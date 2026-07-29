# Twinhaus — the blended workflow

One journey that stitches every shipped feature into a single product story:
**connect → scan → live twin → recommend → locate → talk**, with safety and resilience running
underneath the whole time. Each node maps to code that already exists — this is a build spec for
the connective tissue (a guided first-run flow), not new subsystems.

## The end-to-end flow

```mermaid
flowchart TD
    Start([First run]) --> Connect["Connect Home Assistant<br/>URL + token"]
    Connect -->|success| Layout{"Have a<br/>floor plan?"}
    Connect -->|fails| Retry["Show real error<br/>fail fast, no silent loop"]
    Retry --> Connect

    Layout -->|"no — scan it"| Scan["Scan my home<br/>read HA areas + registries"]
    Layout -->|"no — start blank"| Alt["Template · LiDAR · .glb · photo trace"]
    Layout -->|already built| Twin

    Scan --> Review["Review: rename rooms,<br/>reassign or drop devices"]
    Review --> Apply["Apply to twin"]
    Alt --> Apply
    Apply --> Twin

    Twin["Live 3D twin<br/>rooms + devices, real state"] --> Tap["Tap a device to control"]
    Twin --> Views["Energy heatmap ·<br/>security timeline"]
    Twin --> Gaps{"Coverage gaps?<br/>no lock, no camera…"}

    Gaps -->|yes| Recommend["Recommend a kit<br/>tier + real catalog picks"]
    Recommend --> Simulate["Simulate in twin<br/>preview coverage before buying"]
    Simulate --> AddFlow["Add via Home Assistant<br/>Found near you → config flow"]
    AddFlow --> Twin

    Twin --> Locate{"Want live<br/>positioning?"}
    Locate -->|yes| Proxies["Add BLE proxies<br/>ESPHome config + readiness panel"]
    Proxies --> Dots["Device dots move live<br/>trilateration + confidence halo"]
    Dots --> Twin

    Twin --> Talk["Talk to your home<br/>natural-language agent"]
    Talk --> Loop

    subgraph Loop["Agent safety loop — every control action"]
        direction TB
        Classify["1 Classify risk<br/>safe / sensitive / critical"] --> Gate{"Guarded?"}
        Gate -->|no| Exec["Execute service call"]
        Gate -->|yes| Confirm{"User approves?"}
        Confirm -->|no| Blocked["Declined — not executed"]
        Confirm -->|yes| Exec
        Exec --> Verify["Verify it took effect<br/>+ retry transient failures"]
        Verify --> Report["Report honestly<br/>confirmed / couldn't confirm"]
        Breaker["Circuit breaker + action budget"] -.guards.-> Exec
    end

    Report --> Twin

    subgraph Resilience["Connection resilience — always on"]
        direction TB
        Drop["Socket drops"] --> Reconnect["Auto-reconnect<br/>backoff + jitter"]
        Reconnect --> Resub["Re-subscribe +<br/>reload snapshot"]
        Queue["Commands mid-drop<br/>queued, then flushed"]
    end

    Twin -.heals via.-> Resilience
```

## Node → code map (what to reuse, not rebuild)

| Flow node                       | Lives in                                                                                     |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| Connect Home Assistant          | `apps/web` Settings, `packages/ha-bridge` `HaClient.connect`                                 |
| Scan my home                    | `packages/ha-bridge` registry reads · `apps/web/src/lib/homeScan.ts`                         |
| Review (rename/reassign/drop)   | `homeScan.ts` `applyReview` · `HomeScanPanel`                                                |
| Template · LiDAR · .glb · photo | `templates.ts` · `twinIo.ts` · `ImportPanel`                                                 |
| Live 3D twin + tap to control   | `components/viewer/*` · `deviceControl.ts`                                                   |
| Energy / security views         | `energy.ts` · security timeline                                                              |
| Recommend a kit                 | `recommendations.ts` · `RecommendationWizard`                                                |
| Catalog picks                   | `packages/discovery` `catalog.ts` · `DeviceCatalog`                                          |
| Simulate before buying          | `SimulationPanel` · `CoverageViz` · virtual devices                                          |
| Add via HA (Found near you)     | `packages/discovery` flows · `FoundNearYou`                                                  |
| BLE proxies + readiness         | `docs/positioning/*.yaml` · `positioningSources.ts` `positioningStatus` · `PositioningPanel` |
| Live device dots                | `positioning.ts` · `useLivePositioning` · `DeviceMarker`                                     |
| Talk to your home (agent)       | `packages/agent` · `ChatPanel`                                                               |
| Safety loop                     | `packages/agent` `safety.ts` + `agent.ts` · `verifyAction.ts`                                |
| Connection resilience           | `packages/ha-bridge` `backoff.ts` + `client.ts`                                              |

## The one gap this exposes

Every node above is built — but they live in **separate tabs the user has to discover**. The single
missing piece is the **spine**: a first-run `WelcomeFlow` that walks a new user through
connect → scan → tour → gap-check → positioning nudge → first agent command, each step reusing the
components in the table. That is the difference between "13 features on `main`" and "a product that
sells itself in the first session" — and it's the recommended next build.

## Monetization edges (free core, paid rim — the Nabu Casa model)

```mermaid
flowchart LR
    Core["Free open-source core<br/>twin · agent · scan · safety"] --> Cloud["Hosted / remote access"]
    Core --> Kit["Positioning starter kit<br/>pre-flashed BLE proxies"]
    Core --> Affil["Catalog affiliate<br/>recommended devices"]
    Core --> Pro["Pro install + support"]
```

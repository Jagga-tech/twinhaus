# Position from distance

The home scan puts each device in the right _room_. This is the next layer: placing a device where
it actually is _within_ a room, and tracking things that move (a phone, keys, a pet tag) as their
live dot in the twin. It's the "how does it work from distance?" part of the plan.

## The idea

Twinhaus never ranges hardware itself, Home Assistant does. ESPHome **Bluetooth proxies** (cheap
ESP32s) or the **ESPresense** / **Bermuda** integrations already report how far a device is from
each fixed proxy. Twinhaus consumes those distances and does the geometry:

```
ESP32 proxy A (placed in twin) ─┐   distance sensors in HA
ESP32 proxy B (placed in twin) ─┼─► (device_class: distance, anchor, target)
ESP32 proxy C (placed in twin) ─┘            │
                                             ▼
                              estimatePosition → trilaterate → (x, z) + confidence
                                             │
                                             ▼
                              device dot moves in the twin, ringed by a confidence halo
```

## How the math works

- **RSSI → distance.** Signal strength falls off with distance by the log-distance path-loss model:
  `distance = 10^((refRssi - rssi) / (10·n))`, where `refRssi` is the RSSI at 1 m and `n` is the
  environment exponent (2 in open air, higher through walls). `rssiToDistanceM` does this, useful
  if an integration gives raw RSSI rather than meters.
- **Distances → a point (trilateration).** Each anchor's distance defines a circle; the device sits
  where they intersect. `trilaterate` linearizes the circle equations (subtracting a reference) and
  solves the 2×2 least-squares system, so it uses _all_ anchors, not just three, and averages out
  noise. It needs ≥3 anchors and returns null if they're collinear.
- **Fallbacks.** With one or two anchors, `estimatePosition` blends anchor positions weighted by
  proximity (closer pulls harder) at capped confidence. With none, it declines.
- **Confidence.** Every estimate carries a 0 to 1 confidence from how tightly the distances agree
  (the residual). The twin shows a halo whose opacity tracks confidence, "roughly here", never
  fake precision. Accuracy is room-level reliably, ~1 to 3 m within a room with 3+ proxies; UWB/Matter
  will tighten this to ~10 cm as it lands in HA.

## Wiring it to Home Assistant

The ingestion contract (`positioningSources.ts`) is explicit so it works with any ranging
integration once its output is shaped to match, rather than guessing one vendor's schema. A
**distance sensor** is a `sensor.*` entity whose attributes carry:

- `device_class: 'distance'`
- `anchor`: the entity_id of a device **placed in the twin** (the fixed proxy, its twin
  coordinates become the anchor, so no separate calibration)
- `target`: the entity_id of the device being located

with the numeric state (or `attributes.distance`) giving meters. Anything else is ignored, so the
feature is simply **inert until a ranging integration is present**, it never interferes with a
plain setup.

Turnkey setup files live in [`docs/positioning/`](positioning/):

- [`esphome-bluetooth-proxy.yaml`](positioning/esphome-bluetooth-proxy.yaml), flash to a cheap
  ESP32 to make it a fixed anchor.
- [`distance-template-sensor.yaml`](positioning/distance-template-sensor.yaml), a HA template
  sensor that re-publishes an ESPresense/Bermuda distance in the shape above.

In the app, the **Import → Live positioning** panel reports readiness: how many referenced anchors
are placed, which are still missing, and whether there's enough to trilaterate (`positioningStatus`).

## Where it lives

- **`apps/web/src/lib/positioning.ts`**, the pure engine: `rssiToDistanceM`, `trilaterate`,
  `estimatePosition`. Fully unit-tested with exact and noisy fixtures.
- **`apps/web/src/lib/positioningSources.ts`**, `deriveLivePositions`, the HA-sensor → estimate
  ingestion.
- **`apps/web/src/hooks/useLivePositioning.ts`**, recomputes as placements and live state change.
- **`apps/web` store + `DeviceMarker`**, `livePositions` overrides a device's static placement and
  draws the confidence halo.

## Status

Slice 3 of the home-scan plan (Slice 1 = layout + room placement; Slice 2 = review-before-apply).
The math, the live rendering, the turnkey ESPHome/template configs, and the in-app readiness helper
are all shipped. Remaining polish: a drag-to-calibrate flow for nudging anchor coordinates visually.
